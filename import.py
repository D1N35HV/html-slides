import os
import uuid
from pptx import Presentation
from pptx.dml.color import RGBColor, _NoneColor
from pptx.enum.shapes import PP_PLACEHOLDER, MSO_SHAPE_TYPE, PP_MEDIA_TYPE
from pptx.enum.dml import MSO_THEME_COLOR, MSO_FILL, MSO_THEME_COLOR_INDEX
from pptx.enum.text import MSO_ANCHOR
from pptx.util import Pt
from pptx.oxml import parse_xml
from pptx.opc.constants import RELATIONSHIP_TYPE as RT
import subprocess
import re
import warnings
import json
import sys
import random
import string
import tempfile
import zipfile
import platform
from PIL import Image
from lxml import etree  # For advanced XML parsing
from xml.etree.ElementTree import tostring
from collections import defaultdict
from io import BytesIO
import hashlib
from collections import defaultdict
from io import BytesIO
import zipfile
import tempfile
import shutil

# Try to import Spire.Presentation for better shape rendering (no LibreOffice needed)
try:
    from spire.presentation import Presentation as SpirePresentation
    SPIRE_AVAILABLE = True
except ImportError:
    SPIRE_AVAILABLE = False
    print("[Parser] Spire.Presentation not available, falling back to LibreOffice", file=sys.stderr)



warnings.filterwarnings("ignore", category=UserWarning, message="Duplicate name:")

# Conversion functions
# PPTX font sizes are stored in EMU (1/914400 inch).
# 1pt = 12700 EMU. At 96dpi: 1pt = 96/72 = 1.333px
def emu_to_pt(emu):
    """Convert EMU to typographic points."""
    if emu is None:
        return None
    return emu / 12700

def pt_to_px(pt):
    """Convert typographic points to CSS pixels at 96dpi (fixed, for spacing etc)."""
    if pt is None:
        return None
    return pt * (96.0 / 72.0)

def pt_to_canvas_px(pt, slide_height_emu):
    """
    Convert font size in points to CSS pixels scaled to the 1080px canvas.
    This matches the same proportional scaling used for positions/sizes.

    Formula: px = (pt_in_emu / slide_height_emu) * 1080
           = (pt * 12700 / slide_height_emu) * 1080

    Example: 40pt on standard widescreen (6858000 EMU tall):
      (40 * 12700 / 6858000) * 1080 = 80.0px  (not 53.33px from fixed 96dpi)
    """
    if pt is None or not slide_height_emu:
        return round(pt * (96.0 / 72.0), 2) if pt else None
    px = (pt * 12700.0 / slide_height_emu) * 1080.0
    return round(px, 2)

def emu_to_px_font(emu, slide_height_emu=None):
    """Convert EMU font size to CSS pixels, canvas-proportional when slide height given."""
    if emu is None:
        return None
    pt = emu / 12700.0
    return pt_to_canvas_px(pt, slide_height_emu) if slide_height_emu else round(pt_to_px(pt), 2)

def emu_to_px(emu):
    return int(emu * 96 / 914400)

# Target slide dimensions for the frontend editor
TARGET_WIDTH = 1920
TARGET_HEIGHT = 1080

def emu_to_scaled_px(emu, source_emu, target_px):
    """Convert EMU to pixels, scaled to target slide dimension."""
    if source_emu == 0:
        return 0
    # Scale proportionally: (emu / source_emu) * target_px
    return int((emu / source_emu) * target_px)

# Namespace shorthand used throughout font-size resolution
_NS_A = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
         'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}

def _sz_from_xml_element(el):
    """Return sz attribute (hundredths of a point) as pt float, or None."""
    if el is None:
        return None
    sz = el.get('sz')
    if sz:
        return int(sz) / 100.0  # hundredths-of-a-point → points
    return None

def _sz_from_rPr(el, ns=_NS_A):
    """Find a:rPr inside el and return its sz as pt, or None."""
    rpr = el.find('.//a:rPr', namespaces=ns)
    return _sz_from_xml_element(rpr)

def _sz_from_defRPr(el, ns=_NS_A):
    """Find a:defRPr inside el and return its sz as pt, or None."""
    dfrpr = el.find('.//a:defRPr', namespaces=ns)
    return _sz_from_xml_element(dfrpr)

def _sz_from_lstStyle_level(sp_el, level, ns=_NS_A):
    """Look up size from a:lstStyle for the given outline level (0-based)."""
    lst = sp_el.find('.//a:lstStyle', namespaces=ns)
    if lst is None:
        return None
    level_tag = f'a:lvl{level + 1}pPr'
    lvl_el = lst.find(level_tag, namespaces=ns)
    if lvl_el is not None:
        sz = _sz_from_defRPr(lvl_el, ns) or _sz_from_xml_element(lvl_el)
        if sz:
            return sz
    # Fallback to lvl1pPr
    lvl1 = lst.find('a:lvl1pPr', namespaces=ns)
    return _sz_from_defRPr(lvl1, ns) if lvl1 is not None else None

# ── Alignment inheritance ────────────────────────────────────────────────────
# OOXML stores horizontal alignment on <a:pPr algn="l|ctr|r|just|dist|...">.
# python-pptx's `paragraph.alignment` only reads the paragraph-level attr;
# title/body placeholders typically inherit from the layout/master's
# <a:lstStyle>/<a:lvlNpPr>, so we walk the same inheritance chain
# `get_effective_font_size` already follows.

# Map OOXML algn codes → CSS-friendly names. Anything outside this table
# (dist, thaiDist, justLow) collapses to 'justify' — closest CSS equivalent.
_ALGN_MAP = {
    'l': 'left',
    'ctr': 'center',
    'r': 'right',
    'just': 'justify',
    'dist': 'justify',
    'thaiDist': 'justify',
    'justLow': 'justify',
}

def _algn_from_xml_element(el):
    """Return the algn attribute on this element (already a pPr/lvlNpPr)."""
    if el is None:
        return None
    a = el.get('algn')
    return _ALGN_MAP.get(a) if a else None

def _algn_from_lstStyle_level(sp_el, level, ns=_NS_A):
    """Look up algn from a:lstStyle for the given outline level (0-based)."""
    lst = sp_el.find('.//a:lstStyle', namespaces=ns)
    if lst is None:
        return None
    level_tag = f'a:lvl{level + 1}pPr'
    lvl_el = lst.find(level_tag, namespaces=ns)
    a = _algn_from_xml_element(lvl_el)
    if a:
        return a
    lvl1 = lst.find('a:lvl1pPr', namespaces=ns)
    return _algn_from_xml_element(lvl1)

def get_effective_alignment(paragraph, shape, slide):
    """Resolve the effective horizontal alignment for a paragraph by
    walking pPr → shape lstStyle → layout placeholder lstStyle → master
    placeholder lstStyle. Returns one of 'left'|'center'|'right'|'justify'
    or None if no algn is defined anywhere in the chain (caller decides
    the default — normally 'left')."""
    ns = _NS_A

    # 1. Paragraph's own a:pPr algn (this is what python-pptx already
    #    returns via `paragraph.alignment` — we re-read for completeness).
    try:
        para_el = paragraph._element
        ppr = para_el.find('a:pPr', namespaces=ns)
        a = _algn_from_xml_element(ppr)
        if a:
            return a
    except Exception:
        pass

    # 2. Shape's a:lstStyle for this outline level.
    try:
        level = paragraph.level or 0
        sp_el = shape.element
        a = _algn_from_lstStyle_level(sp_el, level, ns)
        if a:
            return a
    except Exception:
        pass

    # 3 & 4. Layout / Master matching placeholder (only present when
    #        the shape is a placeholder — title/body/etc.).
    ph_idx = None
    try:
        if hasattr(shape, 'placeholder_format') and shape.placeholder_format:
            ph_idx = shape.placeholder_format.idx
    except Exception:
        pass

    if ph_idx is not None and slide is not None:
        try:
            for layout_ph in slide.slide_layout.placeholders:
                if layout_ph.placeholder_format.idx == ph_idx:
                    level = paragraph.level or 0
                    a = _algn_from_lstStyle_level(layout_ph.element, level, ns)
                    if a:
                        return a
                    break
        except Exception:
            pass

        try:
            for master_ph in slide.slide_layout.slide_master.placeholders:
                if master_ph.placeholder_format.idx == ph_idx:
                    level = paragraph.level or 0
                    a = _algn_from_lstStyle_level(master_ph.element, level, ns)
                    if a:
                        return a
                    break
        except Exception:
            pass

    return None

# ── Font color inheritance ──────────────────────────────────────────────────
# OOXML stores run color on <a:rPr>/<a:solidFill>. python-pptx's
# `run.font.color.rgb` returns None when the run has no explicit color — but
# in PowerPoint the run still HAS a color, inherited from the layout/master
# placeholder cascade (a master title's <p:titleStyle> may set accent1).
# Walking the same chain `get_effective_font_size` does prevents the
# silently-default-to-black behaviour that turned every inherited-color title
# black in the editor.

def _color_from_solidfill(sf_el, prs, ns=_NS_A):
    """Resolve an <a:solidFill> child to a 6-hex string (no '#'), or None.
    Handles <a:srgbClr val="HEX"/>, <a:schemeClr val="accent1"/> (theme
    lookup), and <a:sysClr lastClr="HEX"/>."""
    if sf_el is None:
        return None
    srgb = sf_el.find('a:srgbClr', namespaces=ns)
    if srgb is not None and srgb.get('val'):
        return srgb.get('val')
    sch = sf_el.find('a:schemeClr', namespaces=ns)
    if sch is not None and sch.get('val'):
        return get_theme_colors(prs, sch.get('val'))
    sys_clr = sf_el.find('a:sysClr', namespaces=ns)
    if sys_clr is not None and sys_clr.get('lastClr'):
        return sys_clr.get('lastClr')
    return None

def _color_from_rpr(rpr_el, prs, ns=_NS_A):
    """Pull color from an rPr/defRPr's <a:solidFill> child. None when missing."""
    if rpr_el is None:
        return None
    sf = rpr_el.find('a:solidFill', namespaces=ns)
    return _color_from_solidfill(sf, prs, ns)

def _color_from_lstStyle_level(sp_el, level, prs, ns=_NS_A):
    """Color from sp's a:lstStyle/a:lvl{N}pPr/a:defRPr/a:solidFill. Falls
    back to lvl1pPr when the specific level isn't defined."""
    lst = sp_el.find('.//a:lstStyle', namespaces=ns)
    if lst is None:
        return None
    level_tag = f'a:lvl{level + 1}pPr'
    lvl_el = lst.find(level_tag, namespaces=ns)
    if lvl_el is not None:
        defrpr = lvl_el.find('a:defRPr', namespaces=ns)
        c = _color_from_rpr(defrpr, prs, ns)
        if c:
            return c
    lvl1 = lst.find('a:lvl1pPr', namespaces=ns)
    if lvl1 is not None:
        defrpr = lvl1.find('a:defRPr', namespaces=ns)
        return _color_from_rpr(defrpr, prs, ns)
    return None

def _color_from_master_textstyle(master_el, ph_type_str, level, prs, ns=_NS_A):
    """The slide master groups default text styling in three buckets:
       <p:titleStyle>  → ph type 'title' / 'ctrTitle'
       <p:bodyStyle>   → ph type 'body' / 'subTitle' / unspecified
       <p:otherStyle>  → non-placeholder text frames
    Each holds <a:lvl{N}pPr>/<a:defRPr>/<a:solidFill>. Returns the
    resolved color hex for the given placeholder type+level, or None."""
    ph_lower = (ph_type_str or '').lower()
    if 'title' in ph_lower and 'sub' not in ph_lower:
        style_tag = 'titleStyle'
    elif ph_lower in ('body', 'subtitle', '', 'sldimg', 'sldnum', 'dt', 'ftr', 'hdr'):
        style_tag = 'bodyStyle'
    else:
        style_tag = 'otherStyle'
    style_el = master_el.find(f'.//p:{style_tag}', namespaces=ns)
    if style_el is None:
        return None
    level_tag = f'a:lvl{level + 1}pPr'
    lvl_el = style_el.find(level_tag, namespaces=ns) or style_el.find('a:lvl1pPr', namespaces=ns)
    if lvl_el is None:
        return None
    defrpr = lvl_el.find('a:defRPr', namespaces=ns)
    return _color_from_rpr(defrpr, prs, ns)

def get_effective_font_color(run, paragraph, shape, slide, prs):
    """Resolve a run's effective text color by walking the OOXML cascade:
       1. run's own a:rPr/a:solidFill (incl. theme color)
       2. paragraph a:pPr/a:defRPr/a:solidFill
       3. shape a:lstStyle/a:lvl{N}pPr/a:defRPr/a:solidFill
       4. slide layout matching placeholder lstStyle
       5. slide master matching placeholder lstStyle
       6. slide master <p:titleStyle> / <p:bodyStyle> / <p:otherStyle>
    Returns a 6-hex string (no '#') or None when no color is set anywhere
    in the chain (caller decides default — usually black/body text color).
    """
    ns = _NS_A

    # 1. Run-level
    try:
        rgb = getattr(run.font.color, 'rgb', None)
        if rgb is not None:
            s = str(rgb)
            if s and s != 'None':
                return s
    except Exception:
        pass
    try:
        if run.font.color and hasattr(run.font.color, 'theme_color'):
            tc = run.font.color.theme_color
            if tc:
                c = get_theme_colors(prs, tc)
                if c:
                    return c
    except Exception:
        pass
    try:
        run_el = run._element
        rpr = run_el.find('a:rPr', namespaces=ns)
        c = _color_from_rpr(rpr, prs, ns)
        if c:
            return c
    except Exception:
        pass

    # 2. Paragraph defRPr
    try:
        para_el = paragraph._element
        ppr = para_el.find('a:pPr', namespaces=ns)
        if ppr is not None:
            defrpr = ppr.find('a:defRPr', namespaces=ns)
            c = _color_from_rpr(defrpr, prs, ns)
            if c:
                return c
    except Exception:
        pass

    # 3. Shape lstStyle (outline level)
    level = paragraph.level or 0
    try:
        c = _color_from_lstStyle_level(shape.element, level, prs, ns)
        if c:
            return c
    except Exception:
        pass

    # 4 & 5. Layout / master matching placeholder
    ph_idx = None
    ph_type_str = None
    try:
        if hasattr(shape, 'placeholder_format') and shape.placeholder_format:
            ph_idx = shape.placeholder_format.idx
            if shape.placeholder_format.type is not None:
                ph_type_str = str(shape.placeholder_format.type)
    except Exception:
        pass

    if ph_idx is not None and slide is not None:
        try:
            for layout_ph in slide.slide_layout.placeholders:
                if layout_ph.placeholder_format.idx == ph_idx:
                    c = _color_from_lstStyle_level(layout_ph.element, level, prs, ns)
                    if c:
                        return c
                    break
        except Exception:
            pass
        try:
            for master_ph in slide.slide_layout.slide_master.placeholders:
                if master_ph.placeholder_format.idx == ph_idx:
                    c = _color_from_lstStyle_level(master_ph.element, level, prs, ns)
                    if c:
                        return c
                    break
        except Exception:
            pass

    # 6. Master titleStyle / bodyStyle / otherStyle
    if slide is not None:
        try:
            master_el = slide.slide_layout.slide_master.element
            c = _color_from_master_textstyle(master_el, ph_type_str, level, prs, ns)
            if c:
                return c
        except Exception:
            pass

    return None


def get_effective_font_size(run, paragraph, shape, slide, prs=None):
    """
    Resolve the effective font size for a run by walking the OOXML inheritance
    chain from most-specific to least-specific, and return the size in CSS pixels
    scaled proportionally to the 1920×1080 target canvas.

      1. Run's own a:rPr sz
      2. Paragraph's a:pPr/a:defRPr sz
      3. Shape's a:lstStyle for this paragraph outline level
      4. Slide layout matching placeholder lstStyle / defRPr
      5. Slide master matching placeholder lstStyle / defRPr
      6. Fallback defaults by placeholder type (40pt title, 24pt subtitle, 18pt body)

    Returns CSS pixels (float) scaled to 1080px canvas height.
    """
    ns = _NS_A
    # Get slide height in EMU for canvas-proportional scaling
    slide_height_emu = None
    try:
        if prs is not None:
            slide_height_emu = int(prs.slide_height)
    except Exception:
        pass
    if not slide_height_emu:
        slide_height_emu = 6858000  # Standard 7.5" slide height

    def _to_px(sz_pt):
        """Convert pt to canvas-proportional px."""
        return round(pt_to_canvas_px(sz_pt, slide_height_emu), 2)

    ph_idx = None
    ph_type_val = None

    # ── 1. Run-level rPr sz ─────────────────────────────────────────────────
    try:
        if run.font.size is not None:
            return _to_px(run.font.size / 12700.0)
    except Exception:
        pass

    try:
        run_el = run._element
        rpr = run_el.find('a:rPr', namespaces=ns)
        sz = _sz_from_xml_element(rpr)
        if sz:
            return _to_px(sz)
    except Exception:
        pass

    # ── 2. Paragraph defRPr ─────────────────────────────────────────────────
    try:
        para_el = paragraph._element
        ppr = para_el.find('a:pPr', namespaces=ns)
        sz = _sz_from_defRPr(ppr, ns) if ppr is not None else None
        if sz:
            return _to_px(sz)
    except Exception:
        pass

    # ── 3. Shape lstStyle (outline level) ───────────────────────────────────
    try:
        level = paragraph.level or 0
        sp_el = shape.element
        sz = _sz_from_lstStyle_level(sp_el, level, ns)
        if sz:
            return _to_px(sz)
    except Exception:
        pass

    # ── 4 & 5. Layout / Master placeholder ──────────────────────────────────
    try:
        ph_idx = shape.placeholder_format.idx if (
            hasattr(shape, 'placeholder_format') and shape.placeholder_format) else None
        ph_type_val = shape.placeholder_format.type if ph_idx is not None else None
    except Exception:
        pass

    if ph_idx is not None and slide is not None:
        try:
            for layout_ph in slide.slide_layout.placeholders:
                if layout_ph.placeholder_format.idx == ph_idx:
                    level = paragraph.level or 0
                    sz = _sz_from_lstStyle_level(layout_ph.element, level, ns)
                    if sz:
                        return _to_px(sz)
                    for lp in layout_ph.text_frame.paragraphs:
                        for lr in lp.runs:
                            if lr.font.size:
                                return _to_px(lr.font.size / 12700.0)
                    break
        except Exception:
            pass

        try:
            for master_ph in slide.slide_layout.slide_master.placeholders:
                if master_ph.placeholder_format.idx == ph_idx:
                    level = paragraph.level or 0
                    sz = _sz_from_lstStyle_level(master_ph.element, level, ns)
                    if sz:
                        return _to_px(sz)
                    for mp in master_ph.text_frame.paragraphs:
                        for mr in mp.runs:
                            if mr.font.size:
                                return _to_px(mr.font.size / 12700.0)
                    break
        except Exception:
            pass

    # ── 6. Fallback defaults by placeholder type ─────────────────────────────
    try:
        ph_type_str = str(ph_type_val).lower() if ph_type_val else ''
        if 'title' in ph_type_str or 'ctrtitle' in ph_type_str:
            return _to_px(40)   # PowerPoint title default: 40pt
        elif 'subtitle' in ph_type_str:
            return _to_px(24)   # subtitle default: 24pt
    except Exception:
        pass

    return _to_px(18)  # PowerPoint body text default: 18pt


def generate_random_string(length):
    """Generates a random string of the specified length."""
    letters = string.ascii_letters + string.digits
    return ''.join(random.choice(letters) for i in range(length))



def create_ppt_with_layouts(slide_layout, output_dir):
    # Open the original PowerPoint file using python-pptx
    try:
        output_png = f"{output_dir}/layout_{slide_layout.name.replace(' ', '_')}.png"
        if not os.path.exists(output_png):  # Check if the PNG image already exists
            new_prs = Presentation()
            new_prs.slide_width = 11887200 # setting slide width
            new_prs.slide_height = 6686550 # setting slide height
            
            # Set slide_layout width and height to match new_prs
            slide_layout.width = new_prs.slide_width
            slide_layout.height = new_prs.slide_height
            
            output_ppt = f"{output_dir}/layout_{slide_layout.name.replace(' ', '_')}.pptx"
            slide = new_prs.slides.add_slide(slide_layout)  # Add a new slide with that layout
            # Save the new PowerPoint presentation with just layouts
            new_prs.save(output_ppt)
            if platform.system() == "Windows":
                command = ['soffice', '--headless', '--convert-to', 'png', '--outdir', output_dir, output_ppt]
            else:
                command = [
                    'sudo', '/usr/bin/soffice', '--headless', '--convert-to', 'png', '--outdir', output_dir, output_ppt
                ]
            with open(os.devnull, 'w') as devnull:
                subprocess.run(command, stdout=devnull, stderr=devnull, check=True)
            os.remove(output_ppt)
    except Exception as e:
        pass


def get_theme_colors(presentation, theme_color_identifier):
    """
    Get theme colors from presentation with comprehensive support for different identifier types.
    
    Args:
        presentation: The PowerPoint presentation object
        theme_color_identifier: Can be MSO_THEME_COLOR enum, string, or MSO_THEME_COLOR_INDEX enum
    
    Returns:
        String: Hex color code (e.g., "FF0000") or None if not found
    """
    try:
        # Get the theme part from the presentation
        theme_part = presentation.slide_master.part.part_related_by(RT.THEME)
        theme = parse_xml(theme_part.blob)
        
        # Extract all color scheme elements
        namespaces = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
        try:
            color_elements = theme.xpath('//a:themeElements/a:clrScheme/*', namespaces=namespaces)
        except TypeError:
            # Fallback for elements that don't support namespaces parameter
            color_elements = theme.xpath('//a:themeElements/a:clrScheme/*')
        
        # Build comprehensive color mapping
        theme_colors = {}
        
        for element in color_elements:
            # Get the theme color name (remove namespace)
            theme_name = element.tag.replace('{http://schemas.openxmlformats.org/drawingml/2006/main}', '')
            # Initialize color_value to None
            color_value = None
            # Check for srgbClr (RGB color)
            try:
                srgb_elements = element.xpath('.//a:srgbClr', namespaces=namespaces)
            except TypeError:
                srgb_elements = element.xpath('.//a:srgbClr')
            if srgb_elements:
                color_value = srgb_elements[0].get('val')
            
            # Check for sysClr (system color)
            if not color_value:
                try:
                    sys_elements = element.xpath('.//a:sysClr', namespaces=namespaces)
                except TypeError:
                    sys_elements = element.xpath('.//a:sysClr')
                if sys_elements:
                    color_value = sys_elements[0].get('lastClr')
            
            # Check for scrgbClr (linear RGB color) and convert to sRGB
            if not color_value:
                try:
                    scrgb_elements = element.xpath('.//a:scrgbClr', namespaces=namespaces)
                except TypeError:
                    scrgb_elements = element.xpath('.//a:scrgbClr')
                if scrgb_elements:
                    r = int(float(scrgb_elements[0].get('r', '0')) * 255)
                    g = int(float(scrgb_elements[0].get('g', '0')) * 255)
                    b = int(float(scrgb_elements[0].get('b', '0')) * 255)
                    color_value = f"{r:02X}{g:02X}{b:02X}"
            
            if color_value:
                theme_colors[theme_name] = color_value
        
        # Create comprehensive mapping for different identifier types
        color_mappings = {
            # MSO_THEME_COLOR enum mappings
            MSO_THEME_COLOR.DARK_1: 'dk1',
            MSO_THEME_COLOR.LIGHT_1: 'lt1',
            MSO_THEME_COLOR.DARK_2: 'dk2',
            MSO_THEME_COLOR.LIGHT_2: 'lt2',
            MSO_THEME_COLOR.ACCENT_1: 'accent1',
            MSO_THEME_COLOR.ACCENT_2: 'accent2',
            MSO_THEME_COLOR.ACCENT_3: 'accent3',
            MSO_THEME_COLOR.ACCENT_4: 'accent4',
            MSO_THEME_COLOR.ACCENT_5: 'accent5',
            MSO_THEME_COLOR.ACCENT_6: 'accent6',
            MSO_THEME_COLOR.HYPERLINK: 'hlink',
            MSO_THEME_COLOR.FOLLOWED_HYPERLINK: 'folHlink',
            # BACKGROUND_1/2 + TEXT_1/2 (enum values 13–16) follow the
            # default <p:clrMap> mapping that nearly every deck inherits
            # (bg1=lt1, tx1=dk1, bg2=lt2, tx2=dk2). Without these entries
            # python-pptx hands us BACKGROUND_1 for `<a:schemeClr val="bg1"/>`
            # and the lookup falls through to the dk1 fallback below —
            # which silently turned every "white" slide background black.
            MSO_THEME_COLOR.BACKGROUND_1: 'lt1',
            MSO_THEME_COLOR.TEXT_1: 'dk1',
            MSO_THEME_COLOR.BACKGROUND_2: 'lt2',
            MSO_THEME_COLOR.TEXT_2: 'dk2',

            # String mappings (common variations)
            'dk1': 'dk1',
            'lt1': 'lt1',
            'dk2': 'dk2',
            'lt2': 'lt2',
            'accent1': 'accent1',
            'accent2': 'accent2',
            'accent3': 'accent3',
            'accent4': 'accent4',
            'accent5': 'accent5',
            'accent6': 'accent6',
            'hlink': 'hlink',
            'folHlink': 'folHlink',
            'hyperlink': 'hlink',
            'followedhyperlink': 'folHlink',
            'background1': 'lt1',
            'background2': 'lt2',
            'text1': 'dk1',
            'text2': 'dk2',
            
            # Alternative string formats
            'dark1': 'dk1',
            'light1': 'lt1',
            'dark2': 'dk2',
            'light2': 'lt2',
            'bg1': 'lt1',
            'bg2': 'lt2',
        }
        
        # Handle different types of identifiers
        theme_key = None
        
        # If it's an enum value, use the mapping
        if theme_color_identifier in color_mappings:
            theme_key = color_mappings[theme_color_identifier]
        # If it's a string, try direct lookup or mapping
        elif isinstance(theme_color_identifier, str):
            if theme_color_identifier in theme_colors:
                theme_key = theme_color_identifier
            elif theme_color_identifier.lower() in color_mappings:
                theme_key = color_mappings[theme_color_identifier.lower()]
        # If it's a number (MSO_THEME_COLOR_INDEX), convert to appropriate key
        elif isinstance(theme_color_identifier, int):
            index_mappings = {
                1: 'dk1',    # Background 1
                2: 'lt1',    # Text 1
                3: 'dk2',    # Background 2
                4: 'lt2',    # Text 2
                5: 'accent1',
                6: 'accent2',
                7: 'accent3',
                8: 'accent4',
                9: 'accent5',
                10: 'accent6',
                11: 'hlink',
                12: 'folHlink'
            }
            theme_key = index_mappings.get(theme_color_identifier)
        
        # Return the color if found
        if theme_key and theme_key in theme_colors:
            return theme_colors[theme_key]
        
        # Unknown identifier: return None so the caller can cascade to its
        # own fallback. Returning dk1 here silently corrupts every unknown
        # color into black (the previous behavior turned bg1 slide
        # backgrounds dark).
        return None
        
    except Exception as e:
        return None  # Don't default to black - let callers handle missing color


def extract_full_theme(prs):
    """
    Extract complete theme from presentation including all colors and fonts.
    This is used to apply master slide styling to imported content.
    
    Returns:
        dict: Theme data with colors and fonts
    """
    theme_data = {
        "colors": {},
        "fonts": {
            "major": None,  # Heading font
            "minor": None   # Body font
        }
    }
    
    try:
        # Get all theme colors
        color_names = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 
                       'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']
        for color_name in color_names:
            color_value = get_theme_colors(prs, color_name)
            if color_value:
                theme_data["colors"][color_name] = color_value
        
        # Extract theme fonts from master slide
        try:
            theme_part = prs.slide_master.part.part_related_by(RT.THEME)
            theme = parse_xml(theme_part.blob)
            namespaces = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
            
            # Get major font (headings)
            major_font = theme.find('.//a:fontScheme/a:majorFont/a:latin', namespaces=namespaces)
            if major_font is not None and major_font.get('typeface'):
                theme_data["fonts"]["major"] = major_font.get('typeface')
            
            # Get minor font (body)
            minor_font = theme.find('.//a:fontScheme/a:minorFont/a:latin', namespaces=namespaces)
            if minor_font is not None and minor_font.get('typeface'):
                theme_data["fonts"]["minor"] = minor_font.get('typeface')
                
        except Exception as font_error:
            pass  # Use defaults if font extraction fails
    
    except Exception as e:
        pass  # Return empty theme data if extraction fails
    
    return theme_data


def convert_to_base_unit(base_unit, actual_unit, value_in_actual_unit):
    # Calculate the conversion factor
    conversion_factor = base_unit / actual_unit
    # Convert the value to the base unit
    value_in_base_unit = value_in_actual_unit * conversion_factor
    return value_in_base_unit

def get_slide_background(prs, slide, media_folder, slide_idx):
    """Extract the background of a slide."""
    background_info = {"type": None, "color": None, "image": None}
    
    # First check for direct background fill
    if slide.background and slide.background.fill:
        fill = slide.background.fill
        if fill.type == MSO_FILL.SOLID:  # Solid color
            try:
                background_info["type"] = "solid"
                background_info["color"] = str(fill.fore_color.rgb)
            except Exception:
                try:
                    if hasattr(fill.fore_color, 'theme_color'):
                        resolved = get_theme_colors(prs, fill.fore_color.theme_color)
                        if resolved:
                            background_info["type"] = "solid"
                            background_info["color"] = resolved
                except Exception:
                    pass

        elif fill.type == MSO_FILL.GRADIENT:  # Gradient background
            background_info["type"] = "gradient"
            background_info["color"] = "Gradient background not fully supported"

        elif fill.type == MSO_FILL.PICTURE:  # Image background
            background_info["type"] = "image"
            try:
                image = fill.picture.image
                filename = f"slide_{slide_idx + 1}_background_image.png"
                save_media_file(image.blob, media_folder, filename)
                background_info["image"] = filename
            except Exception as e:
                # Fallback to XML-based extraction if no image blob found
                try:
                    slide_xml = slide._element
                    namespaces = {
                        'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
                        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
                    }
                    
                    # Try to find the image relationship from the fill's XML
                    bg_pr = slide_xml.find('.//p:bg/p:bgPr', namespaces=namespaces)
                    if bg_pr is not None:
                        blip_fill = bg_pr.find('.//a:blipFill', namespaces=namespaces)
                        if blip_fill is not None:
                            blip = blip_fill.find('.//a:blip', namespaces=namespaces)
                            if blip is not None:
                                rel_id = blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                                if rel_id:
                                    rel = slide.part.rels.get(rel_id)
                                    if rel and hasattr(rel, 'target_part'):
                                        image_part = rel.target_part
                                        image_data = image_part.blob
                                        
                                        filename = f"slide_{slide_idx + 1}_background_image.png"
                                        save_media_file(image_data, media_folder, filename)
                                        background_info["image"] = filename
                                    else:
                                        background_info["image"] = ""
                                else:
                                    background_info["image"] = ""
                            else:
                                background_info["image"] = ""
                        else:
                            background_info["image"] = ""
                    else:
                        background_info["image"] = ""
                except Exception as ex:
                    print(f"Error extracting background image via XML: {ex}", file=sys.stderr)
                    background_info["image"] = ""

    # Check for background in slide XML with blipFill
    if background_info["type"] is None:
        try:
            slide_xml = slide._element
            namespaces = {
                'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
                'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
            }
            
            # Look for background properties with blipFill
            bg_pr = slide_xml.find('.//p:bg/p:bgPr', namespaces=namespaces)
            if bg_pr is not None:
                blip_fill = bg_pr.find('.//a:blipFill', namespaces=namespaces)
                if blip_fill is not None:
                    blip = blip_fill.find('.//a:blip', namespaces=namespaces)
                    if blip is not None:
                        # Get the relationship ID
                        rel_id = blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                        if rel_id:
                            try:
                                # Find the relationship and get the image
                                rel = slide.part.rels.get(rel_id)
                                if rel and hasattr(rel, 'target_part'):
                                    image_part = rel.target_part
                                    image_data = image_part.blob
                                    
                                    filename = f"slide_{slide_idx + 1}_background_image.png"
                                    save_media_file(image_data, media_folder, filename)
                                    
                                    background_info["type"] = "image"
                                    background_info["image"] = filename
                                    
                            except Exception as e:
                                print(f"Error extracting background image: {e}", file=sys.stderr)
                                
        except Exception as e:
            print(f"Error parsing slide XML for background: {e}", file=sys.stderr)

    # ── Cascade to slide layout background (no LibreOffice) ──────────────
    if background_info["type"] is None:
        background_info = _extract_background_from_part(
            prs, slide.slide_layout, media_folder, slide_idx, "layout"
        )

    # ── Cascade to slide master background ────────────────────────────────
    if background_info["type"] is None:
        background_info = _extract_background_from_part(
            prs, slide.slide_layout.slide_master, media_folder, slide_idx, "master"
        )

    # ── Final fallback: use theme lt1 (background) color ─────────────────
    if background_info["type"] is None:
        lt1 = get_theme_colors(prs, 'lt1')
        if lt1:
            background_info = {"type": "solid", "color": lt1, "image": None}
        else:
            background_info = {"type": "solid", "color": "FFFFFF", "image": None}

    return background_info


def _extract_background_from_part(prs, part, media_folder, slide_idx, suffix):
    """
    Extract background from a slide layout or slide master part (no LibreOffice).
    Returns background_info dict or {"type": None, ...} if nothing found.
    """
    bg_info = {"type": None, "color": None, "image": None}
    try:
        if not hasattr(part, 'background') or part.background is None:
            return bg_info
        fill = part.background.fill
        if fill is None:
            return bg_info

        if fill.type == MSO_FILL.SOLID:
            try:
                bg_info["type"] = "solid"
                bg_info["color"] = str(fill.fore_color.rgb)
            except Exception:
                try:
                    if hasattr(fill.fore_color, 'theme_color'):
                        resolved = get_theme_colors(prs, fill.fore_color.theme_color)
                        if resolved:
                            bg_info["type"] = "solid"
                            bg_info["color"] = resolved
                except Exception:
                    pass

        elif fill.type == MSO_FILL.PICTURE:
            try:
                image = fill.picture.image
                filename = f"slide_{slide_idx + 1}_{suffix}_bg.png"
                save_media_file(image.blob, media_folder, filename)
                bg_info["type"] = "image"
                bg_info["image"] = filename
            except Exception:
                try:
                    ns = {
                        'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
                        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
                    }
                    part_xml = part._element
                    bg_pr = part_xml.find('.//p:bg/p:bgPr', namespaces=ns)
                    if bg_pr is None:
                        bg_pr = part_xml.find('.//p:cSld/p:bg/p:bgPr', namespaces=ns)
                    if bg_pr is not None:
                        blip = bg_pr.find('.//a:blipFill/a:blip', namespaces=ns)
                        if blip is not None:
                            rel_id = blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                            if rel_id:
                                rel = part.part.rels.get(rel_id)
                                if rel and hasattr(rel, 'target_part'):
                                    filename = f"slide_{slide_idx + 1}_{suffix}_bg.png"
                                    save_media_file(rel.target_part.blob, media_folder, filename)
                                    bg_info["type"] = "image"
                                    bg_info["image"] = filename
                except Exception:
                    pass

        elif fill.type == MSO_FILL.GRADIENT:
            bg_info["type"] = "gradient"
            bg_info["color"] = "Gradient background not fully supported"

    except Exception:
        pass

    return bg_info

def get_slide_properties(presentation):
    slide_properties = []
    for slide in presentation.slides:

        properties = {
            "slide_id": slide.slide_id,
            "width": presentation.slide_width,
            "height": presentation.slide_height,
        }
        slide_properties.append(properties)
    return slide_properties


def _solid_fill_alpha(shape_el):
    """Return the <a:alpha val="..."/> on a shape's solid fill as a
    0–1 float, or None when no alpha is set. PPT stores alpha as
    0–100000 (100% opaque). Looks under <p:spPr>/<a:solidFill>; falls
    back to the first <a:solidFill> in the tree because group/text
    backgrounds sometimes nest differently."""
    if shape_el is None:
        return None
    ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
          'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
    candidates = shape_el.findall('.//p:spPr/a:solidFill', namespaces=ns)
    if not candidates:
        candidates = shape_el.findall('.//a:solidFill', namespaces=ns)
    for sf in candidates:
        alpha_el = sf.find('.//a:alpha', namespaces=ns)
        if alpha_el is not None:
            v = alpha_el.get('val')
            if v:
                try:
                    return max(0.0, min(1.0, int(v) / 100000.0))
                except Exception:
                    return None
    return None


def _ooxml_angle_to_rad(emu_angle):
    """OOXML angles are in 60000ths of a degree, measured clockwise
    from the 3-o'clock position. Returns radians using SVG's standard
    math convention (counter-clockwise from x-axis). Negate to map."""
    deg = (emu_angle or 0) / 60000.0
    import math as _m
    return _m.radians(deg)


def _block_arc_svg(adj1, adj2, adj3, width_emu, height_emu, fill_hex, stroke_hex,
                   stroke_w_emu, stroke_dash):
    """Compute an SVG document for PPT's `blockArc` preset using its
    actual `<a:gd>` adjustments — adj1=start angle, adj2=end angle
    (both in OOXML's 60000ths-of-a-degree, clockwise from 3 o'clock),
    adj3=thickness as a fraction of radius (* 100000).

    PPT's static catalog can't represent the arc's start/end/thickness
    so when we hit one of these in SmartArt we render to SVG instead
    and import as a picture. Pure 2D math — no LibreOffice dependency.

    Returns SVG text (utf-8 string) or None when the geometry is
    degenerate."""
    import math as _m
    # Default adjustments (when an `<a:gd>` is missing) per ECMA-376:
    if adj1 is None:
        adj1 = 10800000  # 180°
    if adj2 is None:
        adj2 = 0          # 0°
    if adj3 is None:
        adj3 = 50000      # 50% thickness
    start_deg = (adj1 / 60000.0) % 360.0
    end_deg = (adj2 / 60000.0) % 360.0
    # Thickness as fraction (0..1) of the outer radius.
    thickness = max(0.0, min(0.99, adj3 / 100000.0))
    # SVG viewBox uses px coords. We pick a 100×100 box and let the
    # <img> be sized by the parent <p:sp>'s bounding box — keeps
    # geometry resolution-independent.
    cx, cy = 50.0, 50.0
    r_outer = 50.0
    r_inner = r_outer * (1.0 - thickness)
    if r_inner < 0.5:
        r_inner = 0.5  # avoid degenerate inner arc
    # OOXML angles increase clockwise from 3 o'clock (positive x). SVG's
    # y-axis points DOWN, so a clockwise angle in math terms = same
    # direction visually. Convert deg→rad and use directly with
    # (cos, sin) — y component flipped because SVG y grows downward.
    def _pt(deg, r):
        rad = _m.radians(deg)
        return (cx + r * _m.cos(rad), cy + r * _m.sin(rad))
    p1 = _pt(start_deg, r_outer)
    p2 = _pt(end_deg, r_outer)
    p3 = _pt(end_deg, r_inner)
    p4 = _pt(start_deg, r_inner)
    # Sweep angle traversed clockwise from start to end.
    sweep = (end_deg - start_deg) % 360.0
    if sweep == 0:
        sweep = 360.0
    large_arc_outer = 1 if sweep > 180.0 else 0
    # Outer arc clockwise, inner arc counter-clockwise to close the band.
    path = (
        f"M{p1[0]:.3f},{p1[1]:.3f} "
        f"A{r_outer},{r_outer} 0 {large_arc_outer} 1 {p2[0]:.3f},{p2[1]:.3f} "
        f"L{p3[0]:.3f},{p3[1]:.3f} "
        f"A{r_inner},{r_inner} 0 {large_arc_outer} 0 {p4[0]:.3f},{p4[1]:.3f} "
        f"Z"
    )
    fill_attr = f'fill="#{fill_hex}"' if fill_hex else 'fill="none"'
    stroke_attr = ''
    if stroke_hex:
        # EMU → px at 96dpi assuming 100×100 viewBox maps to outer
        # diameter; without explicit width info we default to 1 unit.
        sw = max(0.5, ((stroke_w_emu or 12700) / 12700.0))
        stroke_attr = f' stroke="#{stroke_hex}" stroke-width="{sw:.2f}"'
        if stroke_dash == 'dashed':
            stroke_attr += ' stroke-dasharray="3 3"'
        elif stroke_dash == 'dotted':
            stroke_attr += ' stroke-dasharray="1 2"'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">'
        f'<path d="{path}" {fill_attr}{stroke_attr} />'
        f'</svg>'
    )


# Presets that the editor's shape catalog renders natively (rect, ellipse,
# stars, arrows, etc.). Mirrors the keys of `PRESET_TO_KIND` in
# apps/api/src/modules/pat/composer/import-pptx/convert.ts — keep these
# two in sync. Any preset NOT listed here is rendered via SVG fallback so
# the source-deck visual identity (callouts, banners, flowchart symbols,
# math operators, etc.) survives the import.
KNOWN_CATALOG_PRESETS = frozenset({
    'rect', 'roundRect', 'round1Rect', 'round2SameRect', 'round2DiagRect',
    'snipRoundRect',
    'ellipse', 'oval',
    'triangle', 'rtTriangle',
    'diamond', 'parallelogram', 'trapezoid',
    'pentagon', 'hexagon', 'heptagon', 'octagon', 'decagon', 'dodecagon',
    'star4', 'star5', 'star6', 'star7', 'star8', 'star10', 'star12',
    'star16', 'star24', 'star32',
    'rightArrow', 'leftArrow', 'upArrow', 'downArrow',
    'homePlate', 'chevron',
    'blockArc', 'arc', 'partialEllipse',
    'line', 'straightConnector1',
})


def _svg_paint_attrs(fill_hex, stroke_hex, stroke_w_px, dash):
    """Build the `fill="..." stroke="..." ...` attribute string. Stroke
    is omitted entirely when width is 0 or unset so SVG inherits the
    browser default (none) rather than painting a hairline outline."""
    if fill_hex:
        fill_str = fill_hex if fill_hex.startswith('#') else f'#{fill_hex}'
        fill_attr = f' fill="{fill_str}"'
    else:
        fill_attr = ' fill="none"'
    stroke_attr = ''
    if stroke_hex and stroke_w_px and stroke_w_px > 0:
        stroke_str = stroke_hex if stroke_hex.startswith('#') else f'#{stroke_hex}'
        sw = max(0.5, float(stroke_w_px))
        stroke_attr = f' stroke="{stroke_str}" stroke-width="{sw:.2f}"'
        if dash == 'dashed':
            stroke_attr += f' stroke-dasharray="{sw*4:.1f},{sw*2:.1f}"'
        elif dash == 'dotted':
            stroke_attr += f' stroke-dasharray="{sw:.1f},{sw*2:.1f}"'
    return fill_attr + stroke_attr


def _preset_svg_inner(preset, w, h, fill_hex, stroke_hex, stroke_w_px, dash):
    """Return SVG body (no wrapping <svg> tag) for the named PPT preset,
    sized to a `w × h` box at origin (0, 0). Used both by single-shape
    SVG fallback in the main loop and by the SmartArt composite builder.

    Unknown presets fall back to a plain rectangle — that's better than
    nothing and matches the converter's current "don't crash on unknown
    geometry" behaviour. Geometry uses simple proportional approximations
    where PowerPoint's preset would normally use adj values; precise
    fidelity to the source deck is not the goal here — visual identity is."""
    import math as _m
    paint = _svg_paint_attrs(fill_hex, stroke_hex, stroke_w_px, dash)
    # Aliases that visually match the named preset family. Group these so
    # adding a flowChart variant doesn't need a new branch every time.
    rect_like = {
        'rect', 'flowChartProcess', 'flowChartPredefinedProcess',
        'flowChartInternalStorage', 'actionButtonBlank',
    }
    round_rect_like = {
        'roundRect', 'flowChartTerminator', 'flowChartAlternateProcess',
    }
    ellipse_like = {
        'ellipse', 'oval', 'flowChartConnector', 'flowChartSummingJunction',
        'flowChartOr',
    }
    diamond_like = {'diamond', 'flowChartDecision', 'flowChartCollate'}

    if preset in rect_like:
        return f'<rect width="{w}" height="{h}"{paint}/>'
    if preset in round_rect_like:
        r = min(w, h) * 0.166
        return f'<rect width="{w}" height="{h}" rx="{r:.2f}" ry="{r:.2f}"{paint}/>'
    if preset == 'snip1Rect':
        s = min(w, h) * 0.2
        d = f'M0,0 L{w-s:.2f},0 L{w:.2f},{s:.2f} L{w:.2f},{h:.2f} L0,{h:.2f} Z'
        return f'<path d="{d}"{paint}/>'
    if preset in ellipse_like:
        rx, ry = w / 2.0, h / 2.0
        return f'<ellipse cx="{rx:.2f}" cy="{ry:.2f}" rx="{rx:.2f}" ry="{ry:.2f}"{paint}/>'
    if preset in diamond_like:
        d = f'M{w/2:.2f},0 L{w:.2f},{h/2:.2f} L{w/2:.2f},{h:.2f} L0,{h/2:.2f} Z'
        return f'<path d="{d}"{paint}/>'
    if preset == 'triangle':
        d = f'M{w/2:.2f},0 L{w:.2f},{h:.2f} L0,{h:.2f} Z'
        return f'<path d="{d}"{paint}/>'
    if preset == 'rtTriangle':
        d = f'M0,0 L0,{h:.2f} L{w:.2f},{h:.2f} Z'
        return f'<path d="{d}"{paint}/>'
    if preset == 'parallelogram':
        off = w * 0.25
        d = f'M{off:.2f},0 L{w:.2f},0 L{w-off:.2f},{h:.2f} L0,{h:.2f} Z'
        return f'<path d="{d}"{paint}/>'
    if preset in ('trapezoid', 'flowChartManualInput'):
        off = w * 0.25
        d = f'M0,{h:.2f} L{off:.2f},0 L{w-off:.2f},0 L{w:.2f},{h:.2f} Z'
        return f'<path d="{d}"{paint}/>'
    if preset == 'chevron':
        d = (
            f'M0,0 L{w*0.75:.2f},0 L{w:.2f},{h/2:.2f} L{w*0.75:.2f},{h:.2f} '
            f'L0,{h:.2f} L{w*0.25:.2f},{h/2:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'homePlate':
        d = f'M0,0 L{w*0.75:.2f},0 L{w:.2f},{h/2:.2f} L{w*0.75:.2f},{h:.2f} L0,{h:.2f} Z'
        return f'<path d="{d}"{paint}/>'
    if preset == 'rightArrow':
        d = (
            f'M0,{h*0.3:.2f} L{w*0.7:.2f},{h*0.3:.2f} L{w*0.7:.2f},0 '
            f'L{w:.2f},{h/2:.2f} L{w*0.7:.2f},{h:.2f} L{w*0.7:.2f},{h*0.7:.2f} '
            f'L0,{h*0.7:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'leftArrow':
        d = (
            f'M{w:.2f},{h*0.3:.2f} L{w*0.3:.2f},{h*0.3:.2f} L{w*0.3:.2f},0 '
            f'L0,{h/2:.2f} L{w*0.3:.2f},{h:.2f} L{w*0.3:.2f},{h*0.7:.2f} '
            f'L{w:.2f},{h*0.7:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'upArrow':
        d = (
            f'M{w*0.3:.2f},{h:.2f} L{w*0.3:.2f},{h*0.3:.2f} L0,{h*0.3:.2f} '
            f'L{w/2:.2f},0 L{w:.2f},{h*0.3:.2f} L{w*0.7:.2f},{h*0.3:.2f} '
            f'L{w*0.7:.2f},{h:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'downArrow':
        d = (
            f'M{w*0.3:.2f},0 L{w*0.3:.2f},{h*0.7:.2f} L0,{h*0.7:.2f} '
            f'L{w/2:.2f},{h:.2f} L{w:.2f},{h*0.7:.2f} L{w*0.7:.2f},{h*0.7:.2f} '
            f'L{w*0.7:.2f},0 Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'leftRightArrow':
        d = (
            f'M0,{h/2:.2f} L{w*0.2:.2f},0 L{w*0.2:.2f},{h*0.3:.2f} '
            f'L{w*0.8:.2f},{h*0.3:.2f} L{w*0.8:.2f},0 L{w:.2f},{h/2:.2f} '
            f'L{w*0.8:.2f},{h:.2f} L{w*0.8:.2f},{h*0.7:.2f} '
            f'L{w*0.2:.2f},{h*0.7:.2f} L{w*0.2:.2f},{h:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'upDownArrow':
        d = (
            f'M{w/2:.2f},0 L{w:.2f},{h*0.2:.2f} L{w*0.7:.2f},{h*0.2:.2f} '
            f'L{w*0.7:.2f},{h*0.8:.2f} L{w:.2f},{h*0.8:.2f} L{w/2:.2f},{h:.2f} '
            f'L0,{h*0.8:.2f} L{w*0.3:.2f},{h*0.8:.2f} L{w*0.3:.2f},{h*0.2:.2f} '
            f'L0,{h*0.2:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'quadArrow':
        # 4-headed cross arrow — eight points per arm.
        cx, cy = w / 2.0, h / 2.0
        t = min(w, h) * 0.15  # half-thickness of the cross arms
        tip = min(w, h) * 0.2  # arrowhead inset from the edge
        d = (
            f'M{cx:.2f},0 L{cx+tip:.2f},{tip:.2f} L{cx+t:.2f},{tip:.2f} '
            f'L{cx+t:.2f},{cy-t:.2f} L{w-tip:.2f},{cy-t:.2f} '
            f'L{w-tip:.2f},{cy-tip:.2f} L{w:.2f},{cy:.2f} '
            f'L{w-tip:.2f},{cy+tip:.2f} L{w-tip:.2f},{cy+t:.2f} '
            f'L{cx+t:.2f},{cy+t:.2f} L{cx+t:.2f},{h-tip:.2f} '
            f'L{cx+tip:.2f},{h-tip:.2f} L{cx:.2f},{h:.2f} '
            f'L{cx-tip:.2f},{h-tip:.2f} L{cx-t:.2f},{h-tip:.2f} '
            f'L{cx-t:.2f},{cy+t:.2f} L{tip:.2f},{cy+t:.2f} '
            f'L{tip:.2f},{cy+tip:.2f} L0,{cy:.2f} '
            f'L{tip:.2f},{cy-tip:.2f} L{tip:.2f},{cy-t:.2f} '
            f'L{cx-t:.2f},{cy-t:.2f} L{cx-t:.2f},{tip:.2f} '
            f'L{cx-tip:.2f},{tip:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'notchedRightArrow':
        d = (
            f'M0,{h*0.3:.2f} L{w*0.7:.2f},{h*0.3:.2f} L{w*0.7:.2f},0 '
            f'L{w:.2f},{h/2:.2f} L{w*0.7:.2f},{h:.2f} L{w*0.7:.2f},{h*0.7:.2f} '
            f'L0,{h*0.7:.2f} L{w*0.15:.2f},{h/2:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'stripedRightArrow':
        # body strip + spacer + arrowhead
        body = (
            f'<rect x="0" y="{h*0.3:.2f}" width="{w*0.08:.2f}" height="{h*0.4:.2f}"{paint}/>'
            f'<rect x="{w*0.12:.2f}" y="{h*0.3:.2f}" width="{w*0.55:.2f}" height="{h*0.4:.2f}"{paint}/>'
        )
        head = (
            f'<path d="M{w*0.7:.2f},0 L{w:.2f},{h/2:.2f} L{w*0.7:.2f},{h:.2f} Z"{paint}/>'
        )
        return body + head
    if preset == 'pentagon':
        pts = []
        for i in range(5):
            a = -_m.pi / 2 + i * 2 * _m.pi / 5
            pts.append(f'{w/2 + (w/2) * _m.cos(a):.2f},{h/2 + (h/2) * _m.sin(a):.2f}')
        return f'<polygon points="{" ".join(pts)}"{paint}/>'
    if preset in ('hexagon', 'heptagon', 'octagon', 'decagon', 'dodecagon'):
        n_map = {'hexagon': 6, 'heptagon': 7, 'octagon': 8, 'decagon': 10, 'dodecagon': 12}
        n = n_map[preset]
        pts = []
        for i in range(n):
            a = -_m.pi / 2 + i * 2 * _m.pi / n
            pts.append(f'{w/2 + (w/2) * _m.cos(a):.2f},{h/2 + (h/2) * _m.sin(a):.2f}')
        return f'<polygon points="{" ".join(pts)}"{paint}/>'
    if preset.startswith('star') and len(preset) > 4 and preset[4:].isdigit():
        n = int(preset[4:])
        outer = min(w, h) / 2.0
        inner = outer * 0.5
        cx, cy = w / 2.0, h / 2.0
        pts = []
        for i in range(2 * n):
            a = -_m.pi / 2 + i * _m.pi / n
            r = outer if i % 2 == 0 else inner
            pts.append(f'{cx + r * _m.cos(a):.2f},{cy + r * _m.sin(a):.2f}')
        return f'<polygon points="{" ".join(pts)}"{paint}/>'
    if preset in ('wedgeRectCallout', 'callout1'):
        d = (
            f'M0,0 L{w:.2f},0 L{w:.2f},{h*0.75:.2f} L{w*0.5:.2f},{h*0.75:.2f} '
            f'L{w*0.3:.2f},{h:.2f} L{w*0.35:.2f},{h*0.75:.2f} L0,{h*0.75:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'wedgeRoundRectCallout':
        r = min(w, h) * 0.1
        d = (
            f'M{r:.2f},0 L{w-r:.2f},0 A{r:.2f},{r:.2f} 0 0 1 {w:.2f},{r:.2f} '
            f'L{w:.2f},{h*0.75-r:.2f} A{r:.2f},{r:.2f} 0 0 1 {w-r:.2f},{h*0.75:.2f} '
            f'L{w*0.5:.2f},{h*0.75:.2f} L{w*0.3:.2f},{h:.2f} L{w*0.35:.2f},{h*0.75:.2f} '
            f'L{r:.2f},{h*0.75:.2f} A{r:.2f},{r:.2f} 0 0 1 0,{h*0.75-r:.2f} '
            f'L0,{r:.2f} A{r:.2f},{r:.2f} 0 0 1 {r:.2f},0 Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'wedgeEllipseCallout':
        return (
            f'<ellipse cx="{w/2:.2f}" cy="{h*0.4:.2f}" rx="{w/2:.2f}" ry="{h*0.4:.2f}"{paint}/>'
            f'<path d="M{w*0.3:.2f},{h*0.65:.2f} L{w*0.2:.2f},{h:.2f} L{w*0.5:.2f},{h*0.7:.2f} Z"{paint}/>'
        )
    if preset in ('cloud', 'cloudCallout'):
        return (
            f'<ellipse cx="{w*0.3:.2f}" cy="{h*0.5:.2f}" rx="{w*0.22:.2f}" ry="{h*0.28:.2f}"{paint}/>'
            f'<ellipse cx="{w*0.5:.2f}" cy="{h*0.4:.2f}" rx="{w*0.22:.2f}" ry="{h*0.3:.2f}"{paint}/>'
            f'<ellipse cx="{w*0.7:.2f}" cy="{h*0.5:.2f}" rx="{w*0.22:.2f}" ry="{h*0.28:.2f}"{paint}/>'
            f'<ellipse cx="{w*0.4:.2f}" cy="{h*0.65:.2f}" rx="{w*0.2:.2f}" ry="{h*0.24:.2f}"{paint}/>'
            f'<ellipse cx="{w*0.6:.2f}" cy="{h*0.65:.2f}" rx="{w*0.2:.2f}" ry="{h*0.24:.2f}"{paint}/>'
        )
    if preset in ('plus', 'mathPlus'):
        t = min(w, h) * 0.3
        d = (
            f'M{w/2-t/2:.2f},0 L{w/2+t/2:.2f},0 L{w/2+t/2:.2f},{h/2-t/2:.2f} '
            f'L{w:.2f},{h/2-t/2:.2f} L{w:.2f},{h/2+t/2:.2f} '
            f'L{w/2+t/2:.2f},{h/2+t/2:.2f} L{w/2+t/2:.2f},{h:.2f} '
            f'L{w/2-t/2:.2f},{h:.2f} L{w/2-t/2:.2f},{h/2+t/2:.2f} '
            f'L0,{h/2+t/2:.2f} L0,{h/2-t/2:.2f} L{w/2-t/2:.2f},{h/2-t/2:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'mathMinus':
        t = h * 0.3
        return f'<rect x="0" y="{h/2-t/2:.2f}" width="{w:.2f}" height="{t:.2f}"{paint}/>'
    if preset == 'mathMultiply':
        # Two crossing rotated bars
        t = min(w, h) * 0.18
        d = (
            f'<line x1="{t:.2f}" y1="{t:.2f}" x2="{w-t:.2f}" y2="{h-t:.2f}"'
            f' stroke-linecap="round"{paint.replace("fill=", "x-fill=")}'
            f' stroke-width="{t*2:.2f}"/>'
            f'<line x1="{w-t:.2f}" y1="{t:.2f}" x2="{t:.2f}" y2="{h-t:.2f}"'
            f' stroke-linecap="round"{paint.replace("fill=", "x-fill=")}'
            f' stroke-width="{t*2:.2f}"/>'
        )
        return d
    if preset == 'heart':
        # Two arcs joined at the top, meeting at the bottom point.
        d = (
            f'M{w/2:.2f},{h:.2f} '
            f'C{-w*0.1:.2f},{h*0.55:.2f} {w*0.1:.2f},{-h*0.1:.2f} '
            f'{w/2:.2f},{h*0.3:.2f} '
            f'C{w*0.9:.2f},{-h*0.1:.2f} {w*1.1:.2f},{h*0.55:.2f} '
            f'{w/2:.2f},{h:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'lightningBolt':
        d = (
            f'M{w*0.5:.2f},0 L{w*0.2:.2f},{h*0.55:.2f} L{w*0.45:.2f},{h*0.55:.2f} '
            f'L{w*0.3:.2f},{h:.2f} L{w*0.8:.2f},{h*0.45:.2f} '
            f'L{w*0.55:.2f},{h*0.45:.2f} L{w*0.7:.2f},0 Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'donut':
        rx_o, ry_o = w / 2.0, h / 2.0
        rx_i, ry_i = rx_o * 0.5, ry_o * 0.5
        d = (
            f'M{rx_o:.2f},0 A{rx_o:.2f},{ry_o:.2f} 0 1 1 {rx_o-0.01:.2f},0 Z '
            f'M{rx_o:.2f},{ry_o-ry_i:.2f} A{rx_i:.2f},{ry_i:.2f} 0 1 0 '
            f'{rx_o-0.01:.2f},{ry_o-ry_i:.2f} Z'
        )
        return f'<path d="{d}" fill-rule="evenodd"{paint}/>'
    if preset == 'noSmoking':
        return (
            f'<ellipse cx="{w/2:.2f}" cy="{h/2:.2f}" rx="{w/2-2:.2f}" ry="{h/2-2:.2f}"'
            f' fill="none" stroke="#FF0000" stroke-width="{min(w,h)*0.08:.2f}"/>'
            f'<line x1="{w*0.15:.2f}" y1="{h*0.15:.2f}" x2="{w*0.85:.2f}"'
            f' y2="{h*0.85:.2f}" stroke="#FF0000" stroke-width="{min(w,h)*0.08:.2f}"'
            f' stroke-linecap="round"/>'
        )
    if preset == 'sun':
        cx, cy = w / 2.0, h / 2.0
        r_body = min(w, h) * 0.25
        r_outer = min(w, h) * 0.45
        rays = []
        for i in range(8):
            a = i * _m.pi / 4
            x1 = cx + r_body * _m.cos(a)
            y1 = cy + r_body * _m.sin(a)
            x2 = cx + r_outer * _m.cos(a)
            y2 = cy + r_outer * _m.sin(a)
            rays.append(
                f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}"'
                f' stroke="{(stroke_hex or fill_hex or "FFC000") if not stroke_hex or "" else stroke_hex}"'
                f' stroke-width="{min(w,h)*0.06:.2f}"/>'
            )
        body = f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r_body:.2f}"{paint}/>'
        return body + ''.join(rays)
    if preset == 'moon':
        d = (
            f'M{w*0.7:.2f},{h*0.1:.2f} A{w*0.45:.2f},{h*0.45:.2f} 0 1 0 '
            f'{w*0.7:.2f},{h*0.9:.2f} A{w*0.3:.2f},{h*0.4:.2f} 0 1 1 '
            f'{w*0.7:.2f},{h*0.1:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'foldedCorner':
        fold = min(w, h) * 0.25
        d = (
            f'M0,0 L{w-fold:.2f},0 L{w:.2f},{fold:.2f} L{w:.2f},{h:.2f} '
            f'L0,{h:.2f} Z M{w-fold:.2f},0 L{w-fold:.2f},{fold:.2f} '
            f'L{w:.2f},{fold:.2f}'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'frame':
        t = min(w, h) * 0.1
        d = (
            f'M0,0 L{w:.2f},0 L{w:.2f},{h:.2f} L0,{h:.2f} Z '
            f'M{t:.2f},{t:.2f} L{w-t:.2f},{t:.2f} L{w-t:.2f},{h-t:.2f} '
            f'L{t:.2f},{h-t:.2f} Z'
        )
        return f'<path d="{d}" fill-rule="evenodd"{paint}/>'
    if preset == 'halfFrame':
        t = min(w, h) * 0.15
        d = (
            f'M0,0 L{w:.2f},0 L{w-t:.2f},{t:.2f} L{t:.2f},{t:.2f} '
            f'L{t:.2f},{h:.2f} L0,{h:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset in ('can', 'flowChartMagneticDisk'):
        ry = h * 0.1
        d = (
            f'<ellipse cx="{w/2:.2f}" cy="{ry:.2f}" rx="{w/2-1:.2f}" ry="{ry:.2f}"{paint}/>'
            f'<rect x="0" y="{ry:.2f}" width="{w:.2f}" height="{h-2*ry:.2f}"{paint}/>'
            f'<path d="M0,{ry:.2f} A{w/2:.2f},{ry:.2f} 0 0 0 {w:.2f},{ry:.2f} L{w:.2f},{h-ry:.2f}'
            f' A{w/2:.2f},{ry:.2f} 0 0 1 0,{h-ry:.2f} Z"{paint}/>'
        )
        return d
    if preset == 'cube':
        d = min(w, h) * 0.2  # depth of bevel
        body = (
            f'<path d="M0,{d:.2f} L{d:.2f},0 L{w:.2f},0 L{w-d:.2f},{d:.2f} Z"{paint}/>'
            f'<path d="M{w:.2f},0 L{w-d:.2f},{d:.2f} L{w-d:.2f},{h:.2f} L{w:.2f},{h-d:.2f} Z"{paint}/>'
            f'<rect x="0" y="{d:.2f}" width="{w-d:.2f}" height="{h-d:.2f}"{paint}/>'
        )
        return body
    if preset == 'bevel':
        b = min(w, h) * 0.12
        return (
            f'<rect width="{w}" height="{h}"{paint}/>'
            f'<path d="M{b:.2f},{b:.2f} L{w-b:.2f},{b:.2f} L{w-b:.2f},{h-b:.2f} L{b:.2f},{h-b:.2f} Z" fill="none"'
            f' stroke="{(stroke_hex or "808080") if (stroke_hex or "").startswith("#") else "#"+(stroke_hex or "808080")}"'
            f' stroke-width="{max(0.5, (stroke_w_px or 1)):.2f}"/>'
        )
    if preset == 'pie':
        return (
            f'<path d="M{w/2:.2f},{h/2:.2f} L{w/2:.2f},0 '
            f'A{w/2:.2f},{h/2:.2f} 0 0 1 {w:.2f},{h/2:.2f} Z"{paint}/>'
        )
    if preset == 'flowChartDocument':
        d = (
            f'M0,0 L{w:.2f},0 L{w:.2f},{h*0.85:.2f} '
            f'C{w*0.75:.2f},{h:.2f} {w*0.25:.2f},{h*0.7:.2f} 0,{h*0.85:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'flowChartPunchedTape':
        d = (
            f'M0,{h*0.15:.2f} '
            f'C{w*0.25:.2f},0 {w*0.75:.2f},{h*0.3:.2f} {w:.2f},{h*0.15:.2f} '
            f'L{w:.2f},{h*0.85:.2f} '
            f'C{w*0.75:.2f},{h:.2f} {w*0.25:.2f},{h*0.7:.2f} 0,{h*0.85:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'flowChartManualOperation':
        d = (
            f'M0,0 L{w:.2f},0 L{w*0.8:.2f},{h:.2f} L{w*0.2:.2f},{h:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset in ('leftBracket', 'rightBracket'):
        t = min(w, h) * 0.1
        if preset == 'leftBracket':
            d = (
                f'M{w:.2f},{t:.2f} L{t:.2f},{t:.2f} L{t:.2f},{h-t:.2f} '
                f'L{w:.2f},{h-t:.2f}'
            )
        else:
            d = (
                f'M0,{t:.2f} L{w-t:.2f},{t:.2f} L{w-t:.2f},{h-t:.2f} L0,{h-t:.2f}'
            )
        stroke_str = (stroke_hex or fill_hex or '000000')
        if not stroke_str.startswith('#'):
            stroke_str = '#' + stroke_str
        return (
            f'<path d="{d}" fill="none" stroke="{stroke_str}"'
            f' stroke-width="{max(2, stroke_w_px or 2):.2f}"/>'
        )
    if preset in ('leftBrace', 'rightBrace'):
        t = min(w, h) * 0.12
        if preset == 'leftBrace':
            d = (
                f'M{w:.2f},0 Q{t:.2f},0 {t:.2f},{h*0.4:.2f} '
                f'Q{t:.2f},{h/2:.2f} 0,{h/2:.2f} '
                f'Q{t:.2f},{h/2:.2f} {t:.2f},{h*0.6:.2f} '
                f'Q{t:.2f},{h:.2f} {w:.2f},{h:.2f}'
            )
        else:
            d = (
                f'M0,0 Q{w-t:.2f},0 {w-t:.2f},{h*0.4:.2f} '
                f'Q{w-t:.2f},{h/2:.2f} {w:.2f},{h/2:.2f} '
                f'Q{w-t:.2f},{h/2:.2f} {w-t:.2f},{h*0.6:.2f} '
                f'Q{w-t:.2f},{h:.2f} 0,{h:.2f}'
            )
        stroke_str = (stroke_hex or fill_hex or '000000')
        if not stroke_str.startswith('#'):
            stroke_str = '#' + stroke_str
        return (
            f'<path d="{d}" fill="none" stroke="{stroke_str}"'
            f' stroke-width="{max(2, stroke_w_px or 2):.2f}"/>'
        )
    if preset == 'smileyFace':
        return (
            f'<circle cx="{w/2:.2f}" cy="{h/2:.2f}" r="{min(w,h)/2-1:.2f}"{paint}/>'
            f'<circle cx="{w*0.35:.2f}" cy="{h*0.4:.2f}" r="{min(w,h)*0.05:.2f}" fill="#000000"/>'
            f'<circle cx="{w*0.65:.2f}" cy="{h*0.4:.2f}" r="{min(w,h)*0.05:.2f}" fill="#000000"/>'
            f'<path d="M{w*0.3:.2f},{h*0.6:.2f} Q{w/2:.2f},{h*0.8:.2f} {w*0.7:.2f},{h*0.6:.2f}"'
            f' fill="none" stroke="#000000" stroke-width="{min(w,h)*0.04:.2f}"/>'
        )
    if preset == 'ribbon':
        d = (
            f'M{w*0.1:.2f},{h*0.2:.2f} L{w*0.9:.2f},{h*0.2:.2f} L{w*0.9:.2f},{h*0.7:.2f} '
            f'L{w:.2f},{h*0.85:.2f} L{w*0.8:.2f},{h*0.7:.2f} L{w*0.2:.2f},{h*0.7:.2f} '
            f'L0,{h*0.85:.2f} L{w*0.1:.2f},{h*0.7:.2f} Z'
        )
        return f'<path d="{d}"{paint}/>'
    if preset == 'plaque':
        c = min(w, h) * 0.15
        d = (
            f'M{c:.2f},0 L{w-c:.2f},0 Q{w:.2f},0 {w:.2f},{c:.2f} '
            f'L{w:.2f},{h-c:.2f} Q{w:.2f},{h:.2f} {w-c:.2f},{h:.2f} '
            f'L{c:.2f},{h:.2f} Q0,{h:.2f} 0,{h-c:.2f} L0,{c:.2f} '
            f'Q0,0 {c:.2f},0 Z'
        )
        return f'<path d="{d}"{paint}/>'
    # Final fallback: a plain rectangle preserves the fill/stroke so the
    # imported shape at least occupies the right place with the right colour.
    return f'<rect width="{w}" height="{h}"{paint}/>'


def _render_shape_as_svg(preset, width_px, height_px, fill_hex, stroke_hex,
                         stroke_w_px, dash):
    """Wrap `_preset_svg_inner` in a complete <svg> document at the
    given pixel size. Caller saves the result to media as `.svg` and
    references it via Picture.image. preserveAspectRatio="none" so the
    geometry stretches with the bounding box (matches how blockArc renders)."""
    w = max(1, int(round(width_px)))
    h = max(1, int(round(height_px)))
    inner = _preset_svg_inner(preset, w, h, fill_hex, stroke_hex, stroke_w_px, dash)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {w} {h}" preserveAspectRatio="none">{inner}</svg>'
    )


def _custgeom_paths_to_svg_d(cust_geom_el, ns_a):
    """Translate a <a:custGeom>/<a:pathLst>/<a:path> tree into one SVG
    `d` attribute. Google Slides exports many "preset-looking" shapes
    (star-bursts, banners, badges) as <a:custGeom> with explicit point
    lists — without this, those shapes fall back to a plain rectangle on
    import and the source-deck visual identity is lost.

    Handles the 6 OOXML path commands: moveTo / lnTo / cubicBezTo /
    quadBezTo / arcTo / close. Coordinates are kept in the path's own
    `w`/`h` space; caller wraps the resulting `d` in an SVG with a
    matching viewBox so the geometry scales to the shape's bounding box.

    Returns (path_d_string, path_w, path_h) or (None, None, None) when
    the custGeom has no usable path."""
    import math as _m
    path_lst = cust_geom_el.find(f'{{{ns_a}}}pathLst')
    if path_lst is None:
        return None, None, None
    paths = path_lst.findall(f'{{{ns_a}}}path')
    if not paths:
        return None, None, None
    # OOXML allows multiple <a:path> children — emit a single `d` with
    # all of them concatenated so multi-region shapes (frame, donut)
    # paint via fill-rule="evenodd" downstream.
    parts = []
    max_w = max_h = 0
    cur_x = cur_y = 0.0
    for p in paths:
        try:
            pw = int(p.get('w', '0'))
            ph = int(p.get('h', '0'))
        except Exception:
            pw = ph = 0
        if pw > max_w:
            max_w = pw
        if ph > max_h:
            max_h = ph
        for cmd in p:
            tag = cmd.tag.split('}', 1)[-1] if '}' in cmd.tag else cmd.tag
            if tag == 'moveTo':
                pt = cmd.find(f'{{{ns_a}}}pt')
                if pt is None:
                    continue
                x = float(pt.get('x', '0'))
                y = float(pt.get('y', '0'))
                parts.append(f'M{x:.2f},{y:.2f}')
                cur_x, cur_y = x, y
            elif tag == 'lnTo':
                pt = cmd.find(f'{{{ns_a}}}pt')
                if pt is None:
                    continue
                x = float(pt.get('x', '0'))
                y = float(pt.get('y', '0'))
                parts.append(f'L{x:.2f},{y:.2f}')
                cur_x, cur_y = x, y
            elif tag == 'cubicBezTo':
                pts = cmd.findall(f'{{{ns_a}}}pt')
                if len(pts) < 3:
                    continue
                xs = [float(p_.get('x', '0')) for p_ in pts[:3]]
                ys = [float(p_.get('y', '0')) for p_ in pts[:3]]
                parts.append(
                    f'C{xs[0]:.2f},{ys[0]:.2f} {xs[1]:.2f},{ys[1]:.2f} '
                    f'{xs[2]:.2f},{ys[2]:.2f}'
                )
                cur_x, cur_y = xs[2], ys[2]
            elif tag == 'quadBezTo':
                pts = cmd.findall(f'{{{ns_a}}}pt')
                if len(pts) < 2:
                    continue
                xs = [float(p_.get('x', '0')) for p_ in pts[:2]]
                ys = [float(p_.get('y', '0')) for p_ in pts[:2]]
                parts.append(
                    f'Q{xs[0]:.2f},{ys[0]:.2f} {xs[1]:.2f},{ys[1]:.2f}'
                )
                cur_x, cur_y = xs[1], ys[1]
            elif tag == 'arcTo':
                # OOXML arcTo: wR/hR = radii, stAng/swAng in 60000ths degree.
                # Start point is the implicit current position; the arc
                # walks from stAng for swAng around an ellipse whose
                # center is at (cur - wR*cos(stAng), cur - hR*sin(stAng)).
                try:
                    wR = float(cmd.get('wR', '0'))
                    hR = float(cmd.get('hR', '0'))
                    stAng = float(cmd.get('stAng', '0')) / 60000.0
                    swAng = float(cmd.get('swAng', '0')) / 60000.0
                except Exception:
                    continue
                st_rad = _m.radians(stAng)
                end_rad = _m.radians(stAng + swAng)
                cx = cur_x - wR * _m.cos(st_rad)
                cy = cur_y - hR * _m.sin(st_rad)
                ex = cx + wR * _m.cos(end_rad)
                ey = cy + hR * _m.sin(end_rad)
                large_arc = 1 if abs(swAng) > 180.0 else 0
                sweep = 1 if swAng > 0 else 0
                parts.append(
                    f'A{wR:.2f},{hR:.2f} 0 {large_arc} {sweep} {ex:.2f},{ey:.2f}'
                )
                cur_x, cur_y = ex, ey
            elif tag == 'close':
                parts.append('Z')
            # Unknown commands are skipped — OOXML's path grammar is
            # closed (these six are everything) but keep defensive.

    if not parts:
        return None, None, None
    if max_w <= 0:
        max_w = 1
    if max_h <= 0:
        max_h = 1
    return ' '.join(parts), max_w, max_h


def _render_custgeom_as_svg(cust_geom_el, ns_a, width_px, height_px,
                            fill_hex, stroke_hex, stroke_w_px, dash):
    """Wrap a custGeom path in a complete <svg> document scaled to the
    shape's bounding box. preserveAspectRatio="none" so non-square paths
    stretch with the box, matching how PowerPoint renders custGeom."""
    d, pw, ph = _custgeom_paths_to_svg_d(cust_geom_el, ns_a)
    if d is None:
        return None
    paint = _svg_paint_attrs(fill_hex, stroke_hex, stroke_w_px, dash)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {pw} {ph}" preserveAspectRatio="none">'
        f'<path d="{d}" fill-rule="evenodd"{paint}/></svg>'
    )


def _smartart_composite_picture(all_sps, gf_shape, prs, media_folder, ns,
                                read_solid_fill, slide_w, slide_h,
                                emu_to_base, parent_nvspr_id):
    """Build a single composite SVG containing every dsp:sp in the
    SmartArt frame, save it to media, and return a Picture-shaped object
    dict. Called only for text-less SmartArts — when there's text we
    decompose so labels stay editable.

    Each sub-shape becomes a `<g transform="translate(off_x, off_y) rotate(...)">`
    wrapping the preset SVG body. The composite viewBox covers the bounding
    box of every sub-shape, so shapes that extend beyond the gf frame
    (common for `blockArc` connectors in process diagrams) still render."""
    import math as _m

    # Pass 1: collect raw sub-shape data we need to size the viewBox.
    records = []
    for sp in all_sps:
        sp_pr = sp.find('dsp:spPr', ns)
        if sp_pr is None:
            continue
        xfrm = sp_pr.find('a:xfrm', ns)
        if xfrm is None:
            continue
        off = xfrm.find('a:off', ns)
        ext = xfrm.find('a:ext', ns)
        if off is None or ext is None:
            continue
        try:
            ox = int(off.get('x', '0'))
            oy = int(off.get('y', '0'))
            ow = int(ext.get('cx', '0'))
            oh = int(ext.get('cy', '0'))
        except Exception:
            continue
        rotation = 0.0
        rot_raw = xfrm.get('rot')
        if rot_raw:
            try:
                rotation = int(rot_raw) / 60000.0
            except Exception:
                rotation = 0.0
        prst_el = sp_pr.find('a:prstGeom', ns)
        preset = prst_el.get('prst') if prst_el is not None else 'rect'
        fill_color = read_solid_fill(sp_pr)
        ln_el = sp_pr.find('a:ln', ns)
        ln_data = _read_ln(ln_el, prs) if ln_el is not None else {
            'color': None, 'dash': None, 'width': None,
        }
        # Parameterised arc presets pull their adj values for fidelity —
        # otherwise the composite renders an empty rect instead of an arc.
        adj1 = adj2 = adj3 = None
        if preset in ('blockArc', 'arc') and prst_el is not None:
            av_lst = prst_el.find('a:avLst', ns)
            if av_lst is not None:
                for gd in av_lst.findall('a:gd', ns):
                    gname = gd.get('name')
                    fmla = gd.get('fmla', '')
                    m = re.match(r'val\s+(-?\d+)', fmla)
                    if not m:
                        continue
                    v = int(m.group(1))
                    if gname == 'adj1':
                        adj1 = v
                    elif gname == 'adj2':
                        adj2 = v
                    elif gname == 'adj3':
                        adj3 = v
        records.append({
            'preset': preset, 'ox': ox, 'oy': oy, 'ow': ow, 'oh': oh,
            'rotation': rotation, 'fill': fill_color, 'ln': ln_data,
            'adj1': adj1, 'adj2': adj2, 'adj3': adj3,
        })

    if not records:
        return None

    # Composite bounding box — cover every sub-shape including those whose
    # off+ext extends past the frame edges (negative offsets, oversized
    # connectors). Clamp to non-negative for the SVG `<rect>` paint.
    min_x = min(r['ox'] for r in records)
    min_y = min(r['oy'] for r in records)
    max_x = max(r['ox'] + r['ow'] for r in records)
    max_y = max(r['oy'] + r['oh'] for r in records)
    box_w = max(1, max_x - min_x)
    box_h = max(1, max_y - min_y)

    # Stroke EMU → SVG units. The composite viewBox uses raw EMU, so the
    # numeric stroke-width is in EMU too — 12700 EMU ≈ 1 pt visually,
    # which lines up with PowerPoint's rendering of `w="12700"`.
    parts = []
    for r in records:
        # Position inside the composite viewBox (frame-local coords).
        gx = r['ox'] - min_x
        gy = r['oy'] - min_y
        ln = r['ln'] or {}
        sw_emu = ln.get('width') or 0
        # blockArc / arc keep their own SVG path generator — it honours
        # the adj-value adjustments which the generic preset table can't.
        if r['preset'] in ('blockArc', 'arc'):
            inner = _block_arc_svg(
                r['adj1'], r['adj2'], r['adj3'],
                r['ow'], r['oh'], r['fill'], ln.get('color'),
                sw_emu, ln.get('dash'),
            )
            # _block_arc_svg returns a full <svg>; we only want the inner
            # <path>. Strip the wrapping tags.
            if inner:
                # Match <svg ...>(.+)</svg>
                m = re.search(r'<svg[^>]*>(.+?)</svg>', inner, re.DOTALL)
                inner_body = m.group(1) if m else ''
                # The block-arc body uses a 100×100 viewBox internally —
                # wrap in a `<svg>` so the inner coordinate system stays
                # independent of the outer composite. preserveAspectRatio
                # none lets it stretch into the sub-shape's box.
                parts.append(
                    f'<svg x="{gx}" y="{gy}" width="{r["ow"]}" '
                    f'height="{r["oh"]}" viewBox="0 0 100 100" '
                    f'preserveAspectRatio="none">{inner_body}</svg>'
                )
            continue

        inner = _preset_svg_inner(
            r['preset'], r['ow'], r['oh'],
            r['fill'], ln.get('color'), sw_emu, ln.get('dash'),
        )
        if r['rotation']:
            cx = r['ow'] / 2.0
            cy = r['oh'] / 2.0
            parts.append(
                f'<g transform="translate({gx},{gy}) '
                f'rotate({r["rotation"]:.2f},{cx:.2f},{cy:.2f})">{inner}</g>'
            )
        else:
            parts.append(f'<g transform="translate({gx},{gy})">{inner}</g>')

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {box_w} {box_h}" preserveAspectRatio="none">'
        f'{"".join(parts)}</svg>'
    )

    svg_filename = f"smartart-composite-{uuid.uuid4().hex[:12]}.svg"
    try:
        save_media_file(svg.encode('utf-8'), media_folder, svg_filename)
    except Exception:
        return None

    # Position the composite Picture so its bounding box matches the union
    # of sub-shape boxes (in slide-absolute coords). For SmartArts whose
    # connectors live entirely inside the gf frame, min_x/min_y are 0.
    frame_off_x = int(gf_shape.left or 0)
    frame_off_y = int(gf_shape.top or 0)
    abs_x = frame_off_x + min_x
    abs_y = frame_off_y + min_y
    return {
        'name': 'SmartArt:composite',
        'type': 'Picture',
        'typenum': MSO_SHAPE_TYPE.AUTO_SHAPE,
        'position_emus': {'left': abs_x, 'top': abs_y, 'width': box_w, 'height': box_h},
        'position': emu_to_base(abs_x, abs_y, box_w, box_h),
        'rotation': 0,
        'paragraph': [],
        'image': svg_filename,
        'fill': {'type': 'picture'},
        'line': {'color': 'No Line', 'width': None},
        **(
            {'nvspr_id': parent_nvspr_id, 'smartart_parent_nvspr_id': parent_nvspr_id}
            if parent_nvspr_id is not None
            else {}
        ),
    }


def _extract_smartart_objects(gf_shape, slide, prs, media_folder=None):
    """Decompose a SmartArt graphic frame into a list of element dicts
    matching the schema the slide-shape loop emits (position, fill,
    line, paragraph, etc.). PowerPoint stores the cached visual
    rendering of every SmartArt under `ppt/diagrams/drawing*.xml` as
    `<dsp:spTree>/<dsp:sp>` — these are real, positioned shapes that
    we can lift into the slide as if the author had drawn them.

    The graphicFrame's `<dgm:relIds dm="rIdN"/>` points at the data
    part; the data part's own rels carry the `diagramDrawing` rel that
    locates the drawing.xml. Shape coordinates inside the drawing are
    relative to the graphic frame's bounding box, so we add the frame
    offset to get absolute slide-coords.

    Returns [] when the shape isn't actually SmartArt or the drawing
    part can't be resolved."""
    NS_DGM = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
    NS_DSP = 'http://schemas.microsoft.com/office/drawing/2008/diagram'
    NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    ns = {'a': NS_A, 'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
          'dgm': NS_DGM, 'dsp': NS_DSP}

    gf_el = gf_shape.element
    rel_ids = gf_el.find('.//dgm:relIds', ns)
    if rel_ids is None:
        return []
    # The parent <p:graphicFrame>'s <p:cNvPr id="N"> — `<p:spTgt spid="N"/>`
    # in <p:timing> references this number to target the SmartArt as a unit.
    parent_nvspr_id = None
    try:
        cn = gf_el.find('.//p:cNvPr', ns)
        if cn is not None and cn.get('id'):
            parent_nvspr_id = int(cn.get('id'))
    except Exception:
        parent_nvspr_id = None
    dm_rid = rel_ids.get(f'{{{NS_R}}}dm')
    if not dm_rid:
        return []
    # Resolve the diagramDrawing rel. PPT puts ALL diagram parts
    # (data/layout/qs/cs/drawing) at the slide level, not at the data
    # level — and `<dgm:relIds>` only links to data/layout/qs/cs, never
    # to drawing. They share a numeric suffix (data1.xml ↔ drawing1.xml)
    # so we match by suffix to handle slides with multiple SmartArts.
    drawing_part = None
    try:
        slide_rels = slide.part.rels
        data_target = None
        try:
            data_target = slide_rels[dm_rid].target_ref  # e.g. "../diagrams/data2.xml"
        except Exception:
            data_target = None
        # Pull the trailing digits from the data filename ("data2.xml" → "2").
        import re as _re
        suffix = None
        if data_target:
            m = _re.search(r'data(\d+)\.xml$', data_target)
            if m:
                suffix = m.group(1)
        # Find drawingN.xml among the slide's diagramDrawing rels.
        for rel in slide_rels.values():
            if 'diagramDrawing' not in rel.reltype:
                continue
            tgt = getattr(rel, 'target_ref', '') or ''
            if suffix is None or _re.search(rf'drawing{suffix}\.xml$', tgt):
                drawing_part = rel.target_part
                break
    except Exception:
        pass
    if drawing_part is None:
        return []
    try:
        drawing_xml = etree.fromstring(drawing_part.blob)
    except Exception:
        return []
    sp_tree = drawing_xml.find('.//dsp:spTree', ns)
    if sp_tree is None:
        return []

    # Frame offset (EMU). All dsp:sp positions are relative to this.
    frame_off_x = int(gf_shape.left or 0)
    frame_off_y = int(gf_shape.top or 0)

    # Slide canvas dims in EMU — needed to project EMU positions to the
    # 1920×1080 base unit the rest of the parser uses.
    try:
        slide_w = int(prs.slide_width)
        slide_h = int(prs.slide_height)
    except Exception:
        slide_w, slide_h = 12192000, 6858000  # default 16:9

    def _emu_to_base(emu_x, emu_y, emu_w, emu_h):
        return {
            'left': round(emu_x / slide_w * TARGET_WIDTH, 2) if slide_w else 0,
            'top': round(emu_y / slide_h * TARGET_HEIGHT, 2) if slide_h else 0,
            'width': round(emu_w / slide_w * TARGET_WIDTH, 2) if slide_w else 0,
            'height': round(emu_h / slide_h * TARGET_HEIGHT, 2) if slide_h else 0,
        }

    def _read_solid_fill(parent_el):
        """Resolve <a:solidFill> color (hex, no #) — handles srgbClr,
        schemeClr (with theme lookup), and per-fill alpha."""
        sf = parent_el.find('a:solidFill', ns)
        if sf is None:
            return None
        color = None
        srgb = sf.find('a:srgbClr', ns)
        if srgb is not None:
            color = srgb.get('val')
        else:
            scheme = sf.find('a:schemeClr', ns)
            if scheme is not None:
                try:
                    color = get_theme_colors(prs, scheme.get('val'))
                except Exception:
                    color = None
        if color:
            alpha_el = sf.find('a:alpha', ns)
            if alpha_el is not None:
                try:
                    a = max(0.0, min(1.0, int(alpha_el.get('val')) / 100000.0))
                    color = _hex_with_alpha(color, a)
                except Exception:
                    pass
        return color

    def _read_font_ref_color(sp_el):
        """Resolve `<dsp:style>/<a:fontRef><a:schemeClr val=".."/>`. PPT
        SmartArt run-level rPr typically omits the text color and the
        renderer pulls it from this fontRef — without this, every text
        run defaults to black against the rect's red background."""
        style_el = sp_el.find('dsp:style', ns)
        if style_el is None:
            return None
        font_ref = style_el.find('a:fontRef', ns)
        if font_ref is None:
            return None
        scheme = font_ref.find('a:schemeClr', ns)
        if scheme is not None:
            try:
                return get_theme_colors(prs, scheme.get('val'))
            except Exception:
                return None
        srgb = font_ref.find('a:srgbClr', ns)
        if srgb is not None:
            return srgb.get('val')
        return None

    def _read_runs(tx_body, default_color=None):
        """Convert <dsp:txBody>/<a:p>/<a:r> into the same paragraph/run
        dicts `extract_paragraph_info` produces, so the converter's
        text branch can render them unchanged. `default_color` fills in
        runs that don't carry their own color — see `_read_font_ref_color`."""
        if tx_body is None:
            return []
        out = []
        for p in tx_body.findall('a:p', ns):
            algn = None
            ppr = p.find('a:pPr', ns)
            if ppr is not None and ppr.get('algn'):
                algn = _ALGN_MAP.get(ppr.get('algn'))
            runs_out = []
            text_concat = ''
            for r in p.findall('a:r', ns):
                t_el = r.find('a:t', ns)
                t = t_el.text if (t_el is not None and t_el.text) else ''
                rpr = r.find('a:rPr', ns)
                font_size = None
                bold = italic = underline = False
                color = None
                font_name = None
                if rpr is not None:
                    sz = rpr.get('sz')
                    if sz:
                        try:
                            # sz is hundredths of a point; convert to canvas px
                            font_size = pt_to_canvas_px(int(sz) / 100.0, slide_h)
                        except Exception:
                            font_size = None
                    bold = rpr.get('b') == '1'
                    italic = rpr.get('i') == '1'
                    underline = rpr.get('u') not in (None, 'none')
                    color = _read_solid_fill(rpr)
                    latin = rpr.find('a:latin', ns)
                    if latin is not None:
                        font_name = latin.get('typeface')
                runs_out.append({
                    'text': t, 'font_name': font_name, 'font_size': font_size,
                    'bold': bold, 'italic': italic, 'underline': underline,
                    'color': color or default_color,
                })
                text_concat += t
            out.append({
                'text': text_concat, 'runs': runs_out, 'level': 0,
                'bullet': False, 'bullet_char': False,
                'alignment': algn, 'space_before': None, 'space_after': None,
                'line_spacing': None, 'indent': None,
            })
        return out

    # ── Text-less SmartArt fast path: composite SVG ─────────────────────
    # When NONE of the sub-shapes carries text content, the SmartArt is
    # purely a visual diagram / illustration (e.g. the "justice scales"
    # clipart). Flatten it into one SVG so the author can move / resize
    # the entire diagram as a unit. SmartArts with text (process/accent
    # diagrams like AGENDA → "Overview" / "Fundamentals") fall through to
    # the per-sub-shape decomposition below so labels stay editable.
    def _sp_has_text(sp_el):
        tb = sp_el.find('dsp:txBody', ns)
        if tb is None:
            return False
        for p in tb.findall('a:p', ns):
            for r in p.findall('a:r', ns):
                t = r.find('a:t', ns)
                if t is not None and (t.text or '').strip():
                    return True
        return False

    all_sps = sp_tree.findall('dsp:sp', ns)
    any_text = any(_sp_has_text(sp) for sp in all_sps)

    if not any_text and media_folder and all_sps:
        composite = _smartart_composite_picture(
            all_sps, gf_shape, prs, media_folder,
            ns, _read_solid_fill, slide_w, slide_h, _emu_to_base,
            parent_nvspr_id,
        )
        if composite is not None:
            return [composite]

    objects = []
    for sp in all_sps:
        sp_pr = sp.find('dsp:spPr', ns)
        if sp_pr is None:
            continue
        xfrm = sp_pr.find('a:xfrm', ns)
        if xfrm is None:
            continue
        off = xfrm.find('a:off', ns)
        ext = xfrm.find('a:ext', ns)
        if off is None or ext is None:
            continue
        try:
            ox = int(off.get('x', '0')) + frame_off_x
            oy = int(off.get('y', '0')) + frame_off_y
            ow = int(ext.get('cx', '0'))
            oh = int(ext.get('cy', '0'))
        except Exception:
            continue
        rotation = 0.0
        try:
            rot_raw = xfrm.get('rot')
            if rot_raw:
                rotation = int(rot_raw) / 60000.0  # 60000ths of a degree
        except Exception:
            rotation = 0.0
        prst_el = sp_pr.find('a:prstGeom', ns)
        preset = prst_el.get('prst') if prst_el is not None else None
        fill_color = _read_solid_fill(sp_pr)
        # Line: reuse _read_ln (works on a generic <a:ln> element).
        ln_el = sp_pr.find('a:ln', ns)
        if ln_el is not None:
            ln_data = _read_ln(ln_el, prs)
        else:
            ln_data = {'color': None, 'dash': None, 'width': None}
        # SmartArt runs typically inherit color from <dsp:style>/<a:fontRef>
        # rather than carrying it inline — pre-resolve here so the run
        # builder can populate every empty rPr.
        font_ref_color = _read_font_ref_color(sp)
        # txBody is on dsp:sp, not spPr.
        tx_body = sp.find('dsp:txBody', ns)
        paragraphs = _read_runs(tx_body, default_color=font_ref_color)
        # Body anchor for vertical alignment + bodyPr insets (lIns/tIns/
        # rIns/bIns) → padding. SmartArt rects routinely set lIns ≈ 410k
        # EMU to make room for the number bubbles overlapping their left
        # edge; without padding the text gets clipped behind those.
        anchor = None
        pad_l = pad_t = pad_r = pad_b = 0
        if tx_body is not None:
            body_pr = tx_body.find('a:bodyPr', ns)
            if body_pr is not None:
                a_attr = body_pr.get('anchor')
                if a_attr in ('ctr', 'middle'):
                    anchor = 'middle'
                elif a_attr in ('b', 'bottom'):
                    anchor = 'bottom'
                else:
                    anchor = 'top'
                # PPT defaults when attr absent: lIns=91440, tIns=45720,
                # rIns=91440, bIns=45720 (in EMU).  Use those to match
                # PPT's rendering when the author left them implicit.
                def _pad_px(emu_val, default_emu):
                    try:
                        v = int(emu_val) if emu_val is not None else default_emu
                    except Exception:
                        v = default_emu
                    return _emu_to_px(v) or 0
                pad_l = _pad_px(body_pr.get('lIns'), 91440)
                pad_t = _pad_px(body_pr.get('tIns'), 45720)
                pad_r = _pad_px(body_pr.get('rIns'), 91440)
                pad_b = _pad_px(body_pr.get('bIns'), 45720)
        position_emus = {'left': ox, 'top': oy, 'width': ow, 'height': oh}
        position = _emu_to_base(ox, oy, ow, oh)

        # Render parameterized presets (blockArc / arc) as an SVG image
        # rather than a catalog shape. Their geometry depends on
        # `<a:gd>` adjustment values (start angle, end angle, thickness)
        # that our static SVG catalog can't honor — round-tripping via
        # an inline SVG keeps the source-deck geometry exact and ships
        # as a regular Picture element the renderer already handles.
        svg_filename = None
        if preset in ('blockArc', 'arc') and media_folder:
            adj1 = adj2 = adj3 = None
            if prst_el is not None:
                av_lst = prst_el.find('a:avLst', ns)
                if av_lst is not None:
                    for gd in av_lst.findall('a:gd', ns):
                        gname = gd.get('name')
                        fmla = gd.get('fmla', '')
                        m = re.match(r'val\s+(-?\d+)', fmla)
                        if not m:
                            continue
                        v = int(m.group(1))
                        if gname == 'adj1':
                            adj1 = v
                        elif gname == 'adj2':
                            adj2 = v
                        elif gname == 'adj3':
                            adj3 = v
            try:
                svg_text = _block_arc_svg(
                    adj1, adj2, adj3, ow, oh,
                    fill_color, ln_data['color'],
                    ln_data['width'], ln_data['dash'],
                )
            except Exception:
                svg_text = None
            if svg_text:
                svg_filename = f"smartart-{uuid.uuid4().hex[:12]}.svg"
                try:
                    save_media_file(
                        svg_text.encode('utf-8'), media_folder, svg_filename,
                    )
                except Exception:
                    svg_filename = None

        obj = {
            'name': f'SmartArt:{preset or "shape"}',
            'type': 'Picture' if svg_filename else 'Shape',
            'typenum': MSO_SHAPE_TYPE.AUTO_SHAPE,
            'position_emus': position_emus,
            'rotation': rotation,
            'paragraph': paragraphs,
            # Tag every decomposed sub-shape with the parent graphicFrame's
            # cNvPr id. SmartArt animations target the frame as a unit
            # (`<p:spTgt spid="..."/>`), and the converter uses this to attach
            # the imported animation onto every sub-shape so the diagram
            # enters together rather than nothing animating at all.
            **(
                {'nvspr_id': parent_nvspr_id, 'smartart_parent_nvspr_id': parent_nvspr_id}
                if parent_nvspr_id is not None
                else {}
            ),
            'fill': {'type': 'picture'} if svg_filename else (
                {'type': 'solid', 'color': fill_color} if fill_color else {'type': 'none'}
            ),
            # When the shape is exported as an SVG image (blockArc/arc),
            # the stroke is already baked into the SVG pixels. Emitting it
            # again as a CSS border would add a second rectangular outline
            # on top of the curved SVG path. Use 'No Line' so the converter
            # skips the border entirely for SVG-image shapes.
            'line': {'color': 'No Line', 'width': None} if svg_filename else {
                'color': ln_data['color'] or 'No Line',
                'width': ln_data['width'],
                **({'dash': ln_data['dash']} if ln_data['dash'] else {}),
            },
            'position': position,
            'preset_geometry': preset,
            'text_anchor': anchor or 'top',
            'padding_left': pad_l,
            'padding_top': pad_t,
            'padding_right': pad_r,
            'padding_bottom': pad_b,
            **({'image': svg_filename} if svg_filename else {}),
        }
        objects.append(obj)
    return objects


def _extract_slide_animations(slide):
    """Extract slide-level entrance/emphasis/exit animations from
    `<p:timing>`. Returns a flat list of dicts ordered as PPT plays them.

    Each entry:
      {
        'spid': int,            # cNvPr id of the target shape
        'preset_class': str,    # 'entr' | 'emph' | 'exit' | 'mediacall' | ...
        'preset_id': int,       # preset numeric id (e.g. 23 = Zoom)
        'preset_subtype': int,  # direction (1=bottom, 2=left, 4=top, 8=right, ...)
        'node_type': str,       # 'clickEffect' | 'withEffect' | 'afterEffect'
        'dur_ms': int | None,   # inner <p:cTn dur="..."> in ms (None if indefinite)
        'delay_ms': int,        # this effect's own start <p:cond delay="...">
        'click_group': int,     # 0-based bucket — same value for all effects in one click
      }

    Skips effects whose target isn't a shape (text builds <p:txEl>, slide
    triggers <p:sldTgt>, motion paths — these fall back to no animation).
    The <p:timing> tree is sometimes wrapped in <mc:AlternateContent>; the
    iter-by-tag-suffix scan handles both shapes."""

    timing = None
    try:
        for el in slide.element.iter():
            if isinstance(el.tag, str) and el.tag.endswith('}timing'):
                timing = el
                break
    except Exception:
        return []
    if timing is None:
        return []

    # Find <p:seq nodeType="mainSeq">. PPT also emits interactive sequences
    # (a click on shape X fires effect Y) under separate <p:seq> nodes —
    # those are out of scope for this slice.
    main_seq = None
    for seq in timing.iter():
        if not (isinstance(seq.tag, str) and seq.tag.endswith('}seq')):
            continue
        first_ctn = None
        for child in seq:
            if isinstance(child.tag, str) and child.tag.endswith('}cTn'):
                first_ctn = child
                break
        if first_ctn is not None and first_ctn.get('nodeType') == 'mainSeq':
            main_seq = seq
            break
    if main_seq is None:
        return []

    # mainSeq → cTn → childTnLst → <p:par> per click bucket.
    main_ctn = None
    for c in main_seq:
        if isinstance(c.tag, str) and c.tag.endswith('}cTn'):
            main_ctn = c
            break
    if main_ctn is None:
        return []
    child_tn_lst = None
    for c in main_ctn:
        if isinstance(c.tag, str) and c.tag.endswith('}childTnLst'):
            child_tn_lst = c
            break
    if child_tn_lst is None:
        return []

    def _local(el):
        """Strip namespace from a tag, returning the local name or ''."""
        if not isinstance(el.tag, str):
            return ''
        idx = el.tag.find('}')
        return el.tag[idx + 1:] if idx >= 0 else el.tag

    def _read_delay(ctn):
        """First <p:cond delay="..."> under this cTn's own start condition.
        We look only at children of this cTn — descendants belong to inner
        timing nodes (the <p:set>/<p:anim> inside <p:childTnLst>)."""
        for c in ctn:
            if _local(c) != 'stCondLst':
                continue
            for cond in c:
                if _local(cond) != 'cond':
                    continue
                d = cond.get('delay')
                if d and d != 'indefinite':
                    try:
                        return int(d)
                    except Exception:
                        return 0
        return 0

    def _read_inner_dur(ctn):
        """`dur` on the FIRST descendant cTn that has one. Effect cTns
        themselves rarely carry `dur` — the duration lives on the inner
        <p:set>/<p:anim>/<p:animEffect>'s <p:cBhvr><p:cTn dur="..."/>."""
        for desc in ctn.iter():
            if desc is ctn:
                continue
            if _local(desc) != 'cTn':
                continue
            d = desc.get('dur')
            if d and d != 'indefinite':
                try:
                    return int(d)
                except Exception:
                    pass
        return None

    out = []
    click_group = -1
    for par in child_tn_lst:
        if _local(par) != 'par':
            continue
        click_group += 1
        # Find every effect cTn inside this click bucket. An effect cTn
        # is recognisable by having both presetID and presetClass set.
        for ctn in par.iter():
            if _local(ctn) != 'cTn':
                continue
            preset_id = ctn.get('presetID')
            preset_class = ctn.get('presetClass')
            if preset_id is None or preset_class is None:
                continue
            node_type = ctn.get('nodeType') or ''
            # Locate <p:spTgt spid="..."> in this cTn's descendants. If we
            # find a <p:sldTgt> or text-only <p:txEl><p:charRg/> instead,
            # skip — those targets aren't supported in this slice.
            spid = None
            for desc in ctn.iter():
                local = _local(desc)
                if local == 'spTgt':
                    s = desc.get('spid')
                    if s:
                        try:
                            spid = int(s)
                        except Exception:
                            spid = None
                    break
                if local == 'sldTgt':
                    spid = None
                    break
            if spid is None:
                continue
            # Motion paths don't map to animate.css — drop them quietly.
            if preset_class == 'path':
                continue
            try:
                preset_id_int = int(preset_id)
            except Exception:
                preset_id_int = 0
            try:
                preset_subtype_int = int(ctn.get('presetSubtype') or 0)
            except Exception:
                preset_subtype_int = 0
            out.append({
                'spid': spid,
                'preset_class': preset_class,
                'preset_id': preset_id_int,
                'preset_subtype': preset_subtype_int,
                'node_type': node_type,
                'dur_ms': _read_inner_dur(ctn),
                'delay_ms': _read_delay(ctn),
                'click_group': click_group,
            })
    return out


def _theme_line_style(prs, idx):
    """Look up theme line style at 1-based `idx` from the slide-master's
    theme `<a:fmtScheme>/<a:lnStyleLst>`. Returns the `<a:ln>` element
    or None. Used to resolve `<p:style>/<a:lnRef idx="N">` outlines so
    style-templated shapes (the common case for "themed" decks) keep
    their dashed/coloured borders.

    Note: parse via `etree.fromstring`, NOT `pptx.oxml.parse_xml` —
    pptx's wrapper element doesn't accept the `namespaces` kwarg on
    xpath/find, which silently broke this lookup before."""
    try:
        theme_part = prs.slide_master.part.part_related_by(RT.THEME)
        theme = etree.fromstring(theme_part.blob)
    except Exception:
        return None
    ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
    # Use findall (works on both lxml and pptx wrappers); descend
    # explicitly through themeElements/fmtScheme rather than `//` so
    # we don't accidentally pick up an unrelated lnStyleLst lower in
    # the tree.
    lst = theme.find('.//a:fmtScheme/a:lnStyleLst', namespaces=ns)
    if lst is None:
        return None
    children = list(lst)
    n = max(1, idx) - 1
    if n < 0 or n >= len(children):
        return None
    return children[n]


def _emu_to_px(emu):
    if emu is None:
        return None
    try:
        return int(int(emu) * 96 / 914400)
    except Exception:
        return None


def _read_ln(ln_el, prs):
    """Pull color/dash/width from a single <a:ln> element. Returns
    {color, dash, width} (any of which may be None). Skips outlines
    that explicitly declare <a:noFill/> as a direct child."""
    if ln_el is None:
        return {"color": None, "dash": None, "width": None}
    ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
    # Direct-child noFill = explicit "no outline".
    if ln_el.find('a:noFill', namespaces=ns) is not None:
        return {"color": None, "dash": None, "width": None}
    color = None
    sf = ln_el.find('a:solidFill', namespaces=ns)
    if sf is not None:
        srgb = sf.find('a:srgbClr', namespaces=ns)
        if srgb is not None:
            color = srgb.get('val')
        else:
            scheme = sf.find('a:schemeClr', namespaces=ns)
            if scheme is not None:
                try:
                    color = get_theme_colors(prs, scheme.get('val'))
                except Exception:
                    color = None
        if color:
            alpha_el = sf.find('a:alpha', namespaces=ns)
            if alpha_el is not None:
                try:
                    a = max(0.0, min(1.0, int(alpha_el.get('val')) / 100000.0))
                    color = _hex_with_alpha(color, a)
                except Exception:
                    pass
    dash = None
    prst = ln_el.find('a:prstDash', namespaces=ns)
    if prst is not None:
        v = (prst.get('val') or '').lower()
        if 'dash' in v:
            dash = 'dashed'
        elif 'dot' in v:
            dash = 'dotted'
        elif v == 'solid':
            dash = 'solid'
    width = ln_el.get('w')
    width_emu = None
    if width:
        try:
            width_emu = int(width)
        except Exception:
            width_emu = None
    return {"color": color, "dash": dash, "width": width_emu}


def _resolve_line_xml(shape_el, prs):
    """Read the shape's outline by walking the source XML in inheritance
    order and **merging** sources, because PPT shapes routinely split
    their outline definition across two places at once:

      - `<p:spPr>/<a:ln>` (inline) supplies whichever subset of fields
        the author overrode in this specific shape — commonly *just* a
        `<a:prstDash val="dash"/>` to dashify a templated outline.
      - `<p:style>/<a:lnRef idx="N">` references the theme's
        `<a:fmtScheme>/<a:lnStyleLst>[N]` for the base width + dash, and
        carries a color override (`<a:schemeClr val="dk1"/>`) inside the
        lnRef that replaces the theme line's `phClr` placeholder.

    Merge order (most specific wins per field): inline → lnRef-color →
    theme-line-defaults. Returns `{color, dash, width}` with hex (no #),
    'solid'|'dashed'|'dotted', and EMU respectively — any may be None.
    python-pptx's `shape.line.color.rgb` raises for theme colors and
    ignores lnRef entirely, so we do this directly."""
    empty = {"color": None, "dash": None, "width": None}
    if shape_el is None:
        return empty
    ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
          'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}

    # ── inline <p:spPr>/<a:ln> ───────────────────────────────────────────
    inline = empty
    inline_no_fill = False
    sp_pr = shape_el.find('p:spPr', namespaces=ns)
    if sp_pr is not None:
        ln = sp_pr.find('a:ln', namespaces=ns)
        if ln is not None:
            inline = _read_ln(ln, prs)
            # An inline <a:ln> with explicit <a:noFill/> means the
            # author turned the outline off — no theme fallback should
            # override that.
            if ln.find('a:noFill', namespaces=ns) is not None:
                inline_no_fill = True

    # ── style reference <p:style>/<a:lnRef idx="N"> ─────────────────────
    ref_color = None
    theme_defaults = empty
    style_el = shape_el.find('p:style', namespaces=ns)
    if style_el is not None:
        ln_ref = style_el.find('a:lnRef', namespaces=ns)
        if ln_ref is not None:
            try:
                idx = int(ln_ref.get('idx', '0'))
            except Exception:
                idx = 0
            # idx="0" is the "no outline" gallery slot — explicit "off".
            if idx == 0:
                # Inline can still re-enable, so fall through to merge.
                pass
            else:
                theme_ln = _theme_line_style(prs, idx)
                if theme_ln is not None:
                    theme_defaults = _read_ln(theme_ln, prs)
                    # Theme's `phClr` placeholder is meaningless without
                    # the lnRef's color — drop it.
                    if theme_defaults["color"] is None:
                        theme_defaults["color"] = None  # already None
            # Color override carried in the lnRef itself.
            scheme = ln_ref.find('a:schemeClr', namespaces=ns)
            if scheme is not None:
                try:
                    ref_color = get_theme_colors(prs, scheme.get('val'))
                except Exception:
                    ref_color = None
            else:
                srgb = ln_ref.find('a:srgbClr', namespaces=ns)
                if srgb is not None:
                    ref_color = srgb.get('val')

    if inline_no_fill:
        # `<a:ln><a:noFill/></a:ln>` is an explicit "no outline".
        return empty

    # Merge per field — first non-None in the inheritance chain wins.
    color = inline["color"] or ref_color or theme_defaults["color"]
    dash = inline["dash"] or theme_defaults["dash"]
    width = inline["width"] if inline["width"] is not None else theme_defaults["width"]
    return {"color": color, "dash": dash, "width": width}


def _line_solid_alpha(shape_el):
    """Same idea as _solid_fill_alpha but scoped to <a:ln>/<a:solidFill>
    so a semi-transparent stroke (`<a:ln>...<a:alpha val="50000"/>`)
    round-trips correctly without picking up the body fill's alpha."""
    if shape_el is None:
        return None
    ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
    for ln in shape_el.findall('.//a:ln', namespaces=ns):
        sf = ln.find('.//a:solidFill', namespaces=ns)
        if sf is None:
            continue
        alpha_el = sf.find('.//a:alpha', namespaces=ns)
        if alpha_el is not None:
            v = alpha_el.get('val')
            if v:
                try:
                    return max(0.0, min(1.0, int(v) / 100000.0))
                except Exception:
                    return None
    return None


def _hex_with_alpha(rgb_hex, alpha_float):
    """Append a 2-digit alpha component to a 6-digit RRGGBB hex string.
    Returns the original string when alpha is None or ~1.0 (fully
    opaque). `rgb_hex` may include or omit the leading `#`."""
    if not rgb_hex or rgb_hex == "No Fill":
        return rgb_hex
    if alpha_float is None or alpha_float >= 0.999:
        return rgb_hex
    a = max(0, min(255, round(alpha_float * 255)))
    base = rgb_hex.lstrip('#')
    if len(base) != 6:
        return rgb_hex
    return f"{base}{a:02x}".upper()


def extract_shape_picture_fill(shape, media_folder):
    """For a shape whose fill is a blipFill (picture fill — e.g. a
    circular photo masked by an ellipse preset, or a `<p:pic>` whose
    image extraction via `shape.image` failed), save the embedded image
    to `media_folder` and return the bare filename. Returns None when
    the shape carries no blipFill or the rel can't be resolved.

    We search the entire shape element rather than scoping to <p:spPr>
    because the blipFill location varies by shape kind:
      - Autoshape with picture fill: <p:sp>/<p:spPr>/<a:blipFill>
      - Picture (<p:pic>):           <p:pic>/<p:blipFill>
      - Group / GraphicFrame:        <p:grpSp>/.../<a:blipFill>
    """
    NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
    NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
    try:
        sp = shape.element
    except Exception:
        return None

    # Find the first blipFill anywhere in the shape's tree, in either
    # the drawingml (a:) or presentationml (p:) namespace. Use the
    # local-name() XPath so we don't have to enumerate both prefixes
    # separately.
    blip_fills = sp.xpath(
        ".//*[local-name()='blipFill']",
    )
    if not blip_fills:
        return None
    blip_fill = blip_fills[0]
    blips = blip_fill.xpath(
        "./*[local-name()='blip']",
    )
    if not blips:
        return None
    blip = blips[0]
    rel_id = blip.get(f"{{{NS_R}}}embed")
    if not rel_id:
        return None
    try:
        rel = shape.part.rels.get(rel_id)
        if rel is None or not hasattr(rel, "target_part"):
            return None
        image_part = rel.target_part
        image_data = image_part.blob
        # Pick the extension from the image part's content type / partname
        # so we don't write a .png header into a .jpg etc.
        ext = ".png"
        partname = ""
        try:
            partname = str(image_part.partname).lower()
        except Exception:
            pass
        for candidate in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"):
            if partname.endswith(candidate):
                ext = candidate
                break
        filename = f"{generate_random_string(16)}{ext}"
        save_media_file(image_data, media_folder, filename)
        return filename
    except Exception as ex:
        print(f"[Parser] picture-fill extract failed: {ex}", file=sys.stderr)
        return None


def is_custgeom_ellipse_like(shape):
    """Return True when a freeform shape's `<a:custGeom>` path traces a
    closed curve with no straight-line segments — i.e. the source mask
    is round (a circle / ellipse / blob), not a polygon. Used to lift a
    synthetic `preset_geometry: 'ellipse'` onto picture-fill freeforms
    so the converter applies the right border-radius mask.

    Heuristics:
      • Path uses arcTo only           → arc-defined ellipse
      • Path uses cubicBezTo / quadBezTo only → Bezier-approximated
        ellipse (PowerPoint emits these for picture crops via the Oval
        in newer .pptx versions)
      • Any lnTo present                → straight edges → polygon → false
    """
    NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
    try:
        sp = shape.element
    except Exception:
        return False
    custgeom = sp.find(f".//{{{NS_A}}}custGeom")
    if custgeom is None:
        return False
    paths = custgeom.findall(f".//{{{NS_A}}}path")
    if not paths:
        return False
    for path in paths:
        arcs = path.findall(f".//{{{NS_A}}}arcTo")
        lines = path.findall(f".//{{{NS_A}}}lnTo")
        beziers = (
            path.findall(f".//{{{NS_A}}}cubicBezTo")
            + path.findall(f".//{{{NS_A}}}quadBezTo")
        )
        if lines:
            return False  # straight edges → not round
        if arcs and not beziers:
            # arcTo-only ellipse path
            return True
        if beziers and not arcs and len(beziers) >= 4:
            # 4+ bezier segments form a Bezier-approximated circle
            return True
    return False


def extract_preset_name(shape):
    """Return the PowerPoint `<a:prstGeom prst="…">` value (e.g. 'rect',
    'ellipse', 'roundRect', 'triangle') for shapes that carry preset
    geometry, or None for tables / pictures / freeform shapes / group
    frames. The Node converter uses this to choose the right Paradiso
    shape catalog id (rectangle vs circle vs triangle…) instead of
    rendering every PPT shape as a rectangle.
    """
    try:
        sp = shape.element
    except Exception:
        return None
    NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
    prst_geom = sp.find(".//a:prstGeom", namespaces=NS)
    if prst_geom is None:
        return None
    return prst_geom.get("prst")


def extract_corner_radius(shape, position_px):
    """Return per-corner radius in canvas pixels for shapes whose preset
    geometry is roundRect / round1Rect / round2SameRect / round2DiagRect /
    snipRoundRect, or None for any other shape.

    PowerPoint's `<a:prstGeom>` `<a:gd name="adj" fmla="val N"/>` stores N
    in 0–50000 fractions of `min(width, height) / 2`. With one adj entry
    (`roundRect`, `round1Rect`) every rounded corner uses the same value;
    `round2DiagRect` / `round2SameRect` use two adj entries for diagonal /
    same-side pairs. Corners not listed in the preset's roster stay at 0.
    """
    if position_px is None:
        return None
    try:
        sp = shape.element  # cast to lxml element via element.element
    except Exception:
        return None

    NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
    prst_geom = sp.find(".//a:prstGeom", namespaces=NS)
    if prst_geom is None:
        return None
    prst = prst_geom.get("prst")
    if not prst:
        return None
    rounded = {
        "roundRect":      ("tl", "tr", "br", "bl"),
        "round1Rect":     ("tl",),
        "round2SameRect": ("tl", "tr"),
        "round2DiagRect": ("tl", "br"),
        # Hybrid snipped+rounded rectangles — round corners only, snipped
        # corners stay sharp. Treat as best-effort for v1.
        "snipRoundRect":  ("bl",),
    }
    if prst not in rounded:
        return None

    adj_values = []
    for gd in prst_geom.findall(".//a:avLst/a:gd", namespaces=NS):
        fmla = gd.get("fmla", "")
        if fmla.startswith("val "):
            try:
                adj_values.append(int(fmla[4:].strip()))
            except ValueError:
                pass
    # PowerPoint default when adj is omitted on roundRect-family is 16667
    # (≈ 1/3 of half the smaller side). Mirror that so a deck that relies
    # on the default still rounds.
    if not adj_values:
        adj_values = [16667]

    width_px = position_px.get("width") or 0
    height_px = position_px.get("height") or 0
    short_side_px = min(width_px, height_px)
    if short_side_px <= 0:
        return None

    def adj_to_px(idx):
        v = adj_values[min(idx, len(adj_values) - 1)]
        return max(0, (v / 50000.0) * (short_side_px / 2.0))

    targets = rounded[prst]
    radius = {"tl": 0, "tr": 0, "br": 0, "bl": 0}
    for i, corner in enumerate(targets):
        radius[corner] = adj_to_px(i)
    return radius


def save_media_file(media, folder_path, filename):
    """Save image, audio, or video to the specified folder."""
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
    with open(os.path.join(folder_path, filename), 'wb') as file:
        file.write(media)


def _sniff_image_ext(blob):
    """Return the correct file extension for an image blob by magic-byte
    sniffing, or None when the format isn't recognised. We need this
    because python-pptx's `Image.ext` derives the extension from the part's
    declared content-type, which is sometimes wrong — notably it reports
    'wmf' for blobs that are actually EMF (magic `01 00 00 00`). Saving an
    EMF blob as `.wmf` then breaks every downstream tool (Inkscape, the
    browser, libwmf) because they sniff the magic too."""
    if not blob or len(blob) < 8:
        return None
    head = blob[:12]
    if head[:8] == b'\x89PNG\r\n\x1a\n':
        return 'png'
    if head[:3] == b'\xff\xd8\xff':
        return 'jpg'
    if head[:6] in (b'GIF87a', b'GIF89a'):
        return 'gif'
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'webp'
    if head[:2] == b'BM':
        return 'bmp'
    if head[:4] == b'<svg' or head[:5] == b'<?xml':
        # Quick SVG sniff; deeper parse not needed since we'd just trust it.
        if b'<svg' in blob[:512]:
            return 'svg'
    # EMF: first record is EMR_HEADER, type=1 (little-endian uint32),
    # followed by record size. Distinct from WMF which uses the placeable
    # header `D7 CD C6 9A` or standard header `(01|02) 00 09 00`.
    if head[:4] == b'\x01\x00\x00\x00':
        return 'emf'
    if head[:4] == b'\xd7\xcd\xc6\x9a' or head[:4] in (b'\x01\x00\x09\x00', b'\x02\x00\x09\x00'):
        return 'wmf'
    return None


# Module-level memo so we don't re-shell out to `which` for every picture
# in a multi-hundred-slide import. None = unchecked; False = checked and
# not present on PATH.
_SOFFICE_BIN_CACHE = None

def _soffice_bin():
    """Return absolute path to the LibreOffice headless binary or None."""
    global _SOFFICE_BIN_CACHE
    if _SOFFICE_BIN_CACHE is not None:
        return _SOFFICE_BIN_CACHE or None
    found = shutil.which('soffice') or shutil.which('libreoffice')
    _SOFFICE_BIN_CACHE = found if found else False
    return found


def _rasterize_metafile_to_png(blob, ext, media_folder):
    """Convert an EMF/WMF blob to PNG via LibreOffice headless and save it
    under `media_folder` with a random filename. Returns the saved filename
    on success, or None when LibreOffice isn't installed / conversion fails.

    Why LibreOffice and not Inkscape (smaller, ~250 MB vs ~750 MB)?
    Inkscape's EMF parser silently drops records it doesn't recognise
    (observed: a 20-ray sunburst collapsing to a solid octagon — same
    failure mode for both `--export-type=svg` and `--export-type=png`).
    LibreOffice's EMF parser is the same one Microsoft Office consumers
    use under Wine and renders the file faithfully.

    `Translucent:1` keeps the background transparent so the rasterised
    metafile composites cleanly over any slide colour. Width is fixed at
    1600 px — large enough for any placement on a 1920 px canvas without
    ballooning the asset library."""
    bin_path = _soffice_bin()
    if bin_path is None:
        return None
    if ext not in ('emf', 'wmf'):
        return None
    in_tmp = None
    out_dir = None
    try:
        # soffice routes by file extension (and chokes on a missing one),
        # and writes the output next to the input under --outdir using the
        # input's basename. Stage both in a private dir so the basename and
        # cleanup are predictable across concurrent imports.
        out_dir = tempfile.mkdtemp(prefix='lo_emf_')
        in_tmp = os.path.join(out_dir, f'in.{ext}')
        with open(in_tmp, 'wb') as f:
            f.write(blob)
        filter_spec = (
            'png:draw_png_Export:'
            '{"PixelWidth":{"type":"long","value":1600},'
            '"PixelHeight":{"type":"long","value":1600},'
            '"Translucent":{"type":"long","value":1}}'
        )
        result = subprocess.run(
            [bin_path, '--headless', '--convert-to', filter_spec,
             '--outdir', out_dir, in_tmp],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=30,
        )
        out_path = os.path.join(out_dir, 'in.png')
        if result.returncode != 0 or not os.path.exists(out_path) or os.path.getsize(out_path) == 0:
            return None
        filename = f"{generate_random_string(16)}.png"
        with open(out_path, 'rb') as src:
            save_media_file(src.read(), media_folder, filename)
        return filename
    except subprocess.TimeoutExpired:
        print(f"[Parser] libreoffice timed out converting {ext.upper()} metafile", file=sys.stderr)
        return None
    except Exception as ex:
        print(f"[Parser] libreoffice metafile conversion failed: {ex}", file=sys.stderr)
        return None
    finally:
        if out_dir and os.path.exists(out_dir):
            try:
                shutil.rmtree(out_dir, ignore_errors=True)
            except Exception:
                pass


def _extract_svg_sibling(shape, media_folder):
    """If the shape's <a:blipFill> carries an <asvg:svgBlip> sibling
    (Microsoft's SVG-alongside-raster extension at
    schemas.microsoft.com/office/drawing/2016/SVG/main), save the SVG
    via its relationship and return the random filename. Returns None
    when the shape has no SVG sibling or the sibling can't be resolved.

    Modern PowerPoints emit this for vector icons / logos so legacy
    consumers still see a raster preview while compliant viewers get the
    sharp vector. We always prefer the SVG: browsers render it natively
    via <img>, the API already serves image/svg+xml for .svg, and it
    avoids the broken-icon problem when the raster sibling is an EMF."""
    try:
        ns = {
            'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
            'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
            'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
            'asvg': 'http://schemas.microsoft.com/office/drawing/2016/SVG/main',
        }
        shape_xml = etree.fromstring(shape.element.xml)
        # <asvg:svgBlip> nests inside <a:blip>/<a:extLst>/<a:ext>. The
        # enclosing <blipFill> may live in either the `p:` namespace (for
        # <p:pic>) or the `a:` namespace (for <a:sp> fills), so search by
        # the svgBlip tag itself rather than its container.
        svg_blip = shape_xml.find('.//asvg:svgBlip', namespaces=ns)
        if svg_blip is None:
            return None
        rel_id = svg_blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
        if not rel_id:
            return None
        rel = shape.part.rels.get(rel_id)
        if rel is None or not hasattr(rel, 'target_part'):
            return None
        filename = f"{generate_random_string(16)}.svg"
        save_media_file(rel.target_part.blob, media_folder, filename)
        return filename
    except Exception as ex:
        print(f"[Parser] svg sibling extraction failed: {ex}", file=sys.stderr)
        return None

def sanitize_xml(xml_string):
    # Remove invalid XML characters
    return re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", xml_string)

def remove_white_background(image_path, output_path, tolerance=245, alpha_threshold=200):
    # Open the image
    img = Image.open(image_path)
    img = img.convert("RGBA")
    datas = img.getdata()
    width, height = img.size

    # Convert to list for easier processing
    pixels = list(datas)
    
    # First pass: identify magenta background pixels (our custom background)
    newData = []
    for i, item in enumerate(pixels):
        # More comprehensive background detection to handle anti-aliasing and compression artifacts
        r, g, b, a = item
        
        # Check for pure magenta and magenta-like colors (including anti-aliased edges)
        is_magenta_bg = False
        
        # Pure magenta detection
        if abs(r - 255) <= 15 and abs(g - 0) <= 15 and abs(b - 255) <= 15:
            is_magenta_bg = True
        
        # Magenta-dominant colors (when red and blue are high, green is low)
        elif r > 200 and b > 200 and g < 50:
            is_magenta_bg = True
            
        # Anti-aliased magenta edges (partial magenta mixed with other colors)
        elif r > 150 and b > 150 and g < r/2 and g < b/2:
            is_magenta_bg = True
        
        # Check for blue-tinted artifacts (common LibreOffice compression artifact)
        # Made more conservative to avoid removing legitimate blue content
        is_blue_artifact = False
        # Only consider very specific blue artifacts that are likely compression issues
        if b > 240 and r < 50 and g < 50:  # Very strong blue with very low red/green (likely artifact)
            is_blue_artifact = True
        elif abs(b - 255) <= 10 and r < 30 and g < 30:  # Near-pure blue with minimal other colors (likely artifact)
            is_blue_artifact = True
        
        is_transparent = a < alpha_threshold
        
        if is_magenta_bg or is_blue_artifact or is_transparent:
            # Make background pixels transparent
            newData.append((255, 255, 255, 0))
        else:
            # Keep all other pixels (including white shape content)
            newData.append(item)

    # Process the image to remove border artifacts by cleaning edge pixels
    img.putdata(newData)
    
    # Second pass: Only remove white pixels that are on the edges (likely background artifacts)
    # This preserves white content that's part of the actual shape
    expanded_img = img.copy()
    pixels = expanded_img.load()
    
    # Process edge pixels only - remove white pixels that are on the border
    for y in range(height):
        for x in range(width):
            # Check if pixel is on the edge of the image
            is_edge = (x == 0 or x == width-1 or y == 0 or y == height-1)
            
            if is_edge and pixels[x, y][3] > 0:  # If edge pixel is not already transparent
                # Check if it's white or near-white OR magenta-like OR blue artifact
                pixel = pixels[x, y]
                r, g, b, a = pixel
                
                is_white_edge = (r >= tolerance and g >= tolerance and b >= tolerance)
                # Also remove any remaining magenta-like colors on edges
                is_magenta_edge = (r > 150 and b > 150 and g < r/2) or (r > 200 and b > 200 and g < 50)
                # Remove blue artifacts on edges (more conservative - only very obvious artifacts)
                is_blue_edge = (b > 240 and r < 50 and g < 50) or (abs(b - 255) <= 10 and r < 30 and g < 30)
                
                if is_white_edge or is_magenta_edge or is_blue_edge:
                    pixels[x, y] = (255, 255, 255, 0)
    
    # Third pass: Clean up remaining border artifacts by checking neighbors
    for y in range(1, height-1):
        for x in range(1, width-1):
            pixel = pixels[x, y]
            r, g, b, a = pixel
            
            # Handle semi-transparent pixels and remaining magenta/blue artifacts
            if 0 < a < 255:  # Semi-transparent pixels
                transparent_neighbors = 0
                for dx in [-1, 0, 1]:
                    for dy in [-1, 0, 1]:
                        if dx == 0 and dy == 0:
                            continue
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < width and 0 <= ny < height and pixels[nx, ny][3] == 0:
                            transparent_neighbors += 1
                
                # If surrounded by multiple transparent pixels, likely a border artifact
                if transparent_neighbors >= 5:  # Conservative threshold
                    pixels[x, y] = (255, 255, 255, 0)
            
            # Also check for any remaining magenta-like or blue artifact pixels that weren't caught
            elif a > 0:  # Opaque pixels
                is_remaining_magenta = (r > 180 and b > 180 and g < 80) or (r > 150 and b > 150 and g < r/3)
                # Much more conservative blue artifact detection to preserve legitimate blue content
                is_remaining_blue = (b > 240 and r < 50 and g < 50) or (abs(b - 255) <= 10 and r < 30 and g < 30)
                
                if is_remaining_magenta or is_remaining_blue:
                    pixels[x, y] = (255, 255, 255, 0)
                    
            # Special handling for pixels near edges that might be blue artifacts
            is_near_edge = (x <= 2 or x >= width-3 or y <= 2 or y >= height-3)
            if is_near_edge and a > 0:
                # Very conservative blue detection near edges - only remove obvious artifacts
                is_edge_blue = (b > 240 and r < 40 and g < 40) or (abs(b - 255) <= 8 and r < 25 and g < 25)
                if is_edge_blue:
                    pixels[x, y] = (255, 255, 255, 0)
    
    expanded_img.save(output_path, "PNG")
def adjust_dimensions(shape_width, shape_height, max_limit, min_limit):
    """
    Adjust the dimensions of a shape to fit within the specified range, maintaining the aspect ratio.

    Parameters:
    - shape_width (float): The original width of the shape in EMUs.
    - shape_height (float): The original height of the shape in EMUs.
    - max_limit (float): The maximum allowable size for either dimension in EMUs.
    - min_limit (float): The minimum allowable size for either dimension in EMUs.

    Returns:
    - tuple: The adjusted width and height in EMUs.
    """
    # Check if both dimensions are within limits
    if min_limit <= shape_width <= max_limit and min_limit <= shape_height <= max_limit:
        return shape_width, shape_height

    # Calculate aspect ratio
    aspect_ratio = shape_width / shape_height

    # Adjust dimensions to fit within limits
    if shape_width > max_limit or shape_height > max_limit:
        if shape_width > shape_height:
            shape_width = max_limit
            shape_height = shape_width / aspect_ratio
        else:
            shape_height = max_limit
            shape_width = shape_height * aspect_ratio

    if shape_width < min_limit or shape_height < min_limit:
        if shape_width < shape_height:
            shape_width = min_limit
            shape_height = shape_width / aspect_ratio
        else:
            shape_height = min_limit
            shape_width = shape_height * aspect_ratio

    return int(shape_width), int(shape_height)

exported_shapes = defaultdict(dict)

def export_shape_with_spire(pptx_path, slide_idx, shape_idx, output_path):
    """
    Export a shape using Spire.Presentation (no LibreOffice needed).
    Note: Spire.Presentation.Free has limited shape export capabilities,
    so this uses slide rendering and cropping as a workaround.
    
    Args:
        pptx_path: Path to the original PPTX file
        slide_idx: Slide index (0-based)
        shape_idx: Shape index within the slide (0-based)
        output_path: Output PNG file path
    
    Returns:
        Path to the exported PNG or None if failed
    """
    if not SPIRE_AVAILABLE:
        return None
    
    try:
        # Load the presentation with Spire
        spire_prs = SpirePresentation()
        spire_prs.LoadFromFile(pptx_path)
        
        # Get the slide
        slide = spire_prs.Slides[slide_idx]
        
        # Try to get shape and use SaveAsImage if available
        try:
            shape = slide.Shapes[shape_idx]
            # Try shape.SaveAsImage() - may not be available in free version
            if hasattr(shape, 'SaveAsImage'):
                image = shape.SaveAsImage()
                image.Save(output_path)
                spire_prs.Dispose()
                return output_path
        except Exception as shape_error:
            pass
        
        # Fallback: Render entire slide and crop to shape bounds
        # This is less ideal but works with free version
        try:
            # Get slide as image
            image = slide.SaveAsImage()
            image.Save(output_path)
            spire_prs.Dispose()
            
            # Note: For full implementation, would crop to shape bounds
            # For now, return None to fall back to LibreOffice
            os.remove(output_path)  # Clean up
            return None
        except Exception as slide_error:
            pass
        
        spire_prs.Dispose()
        return None
        
    except Exception as e:
        print(f"[Spire] Error exporting shape: {e}", file=sys.stderr)
        return None



def get_shape_key(shape):
    """Generate a unique key for shape identification, preferring creationId if available"""
    try:
        # Try to get the creationId attribute from the shape element
        nsmap = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
        shape_props = shape.element.find('.//p:nvPr', namespaces=nsmap)
        
        if shape_props is not None:
            creation_id = shape_props.get('creationId')
            if creation_id:
                return f"id_{creation_id}"
        
        # Fall back to the original method if no creationId is found
        content = etree.tostring(shape.element).decode('utf-8')
        return f"{shape.shape_type}_{shape.width}_{shape.height}_{len(content)}"
    except:
        return None

def export_grouped_shape_to_png(shape, output_png, export_path):
    # Check if shape was already exported
    shape_id = get_shape_key(shape)
    if shape_id and shape_id in exported_shapes:
        return exported_shapes[shape_id]

    # Create a new presentation for exporting
    export_prs = Presentation()

    try:
        if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
            for grouped_shape in shape.shapes:
                # Remove the shadow if it exists
                if grouped_shape.shadow:
                    grouped_shape.shadow.inherit = True  # Inherit from parent (this removes any shadow applied)
        if type(shape).__name__ == "Shape":
            if shape.shadow:
                shape.shadow.inherit = True  # Inherit from parent (this removes any shadow applied)
        #remove rotation from the shape
        if hasattr(shape, 'rotation'):
            shape.rotation = 0
        #remove the flip from the shape
        # Remove flip attributes directly from XML since python-pptx doesn't support it through API
        try:
            nsmap = {
            'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
            'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'
            }
              # Try common paths where xfrm might be located
            xfrm = shape.element.find('.//p:xfrm', namespaces=nsmap)
            if xfrm is None:
                xfrm = shape.element.find('.//a:xfrm', namespaces=nsmap)
               
            if xfrm is not None:
                # Remove flip attributes if they exist
                if 'flipH' in xfrm.attrib:
                    del xfrm.attrib['flipH']
                if 'flipV' in xfrm.attrib:
                    del xfrm.attrib['flipV']
        except Exception as e:
            # Silently continue if we can't modify the XML
            pass

                
        # Get shape dimensions
        shape_width = shape.width
        shape_height = shape.height

        # Validate and adjust dimensions to fit within allowed range, maintaining aspect ratio
        max_limit = 51206400  # 56 inches in EMUs
        min_limit = 914400    # 1 inch in EMUs

        scaled_width, scaled_height = adjust_dimensions(shape_width, shape_height, max_limit, min_limit)

        # Extract the XML of the grouped shape
        shape_xml = shape.element
    

        # Check if shape has relationships
        has_relationships = False
        relationship_ids = []

        # Parse shape XML to find relationship references
        try:
            shape_xml_str = etree.tostring(shape_xml, encoding='unicode')
            
            # Look for relationship ID patterns in the XML
            rel_id_patterns = [
                r'r:embed="([^"]+)"',  # Embedded objects
                r'r:link="([^"]+)"',   # Linked objects
                r'r:id="([^"]+)"',     # General relationship references
                r'r:pict="([^"]+)"',   # Picture relationships
            ]
            
            for pattern in rel_id_patterns:
                matches = re.findall(pattern, shape_xml_str)
                if matches:
                    has_relationships = True
                    relationship_ids.extend(matches)
            
            # Also check for blip elements which commonly contain relationships
            blip_elements = shape_xml.xpath('.//a:blip', namespaces={'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'})
            for blip in blip_elements:
                for attr_name, attr_value in blip.attrib.items():
                    if attr_name.startswith('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'):
                        has_relationships = True
                        relationship_ids.append(attr_value)
                        
        except Exception as e:
            pass  # Continue without relationship detection if parsing fails
        
        
                
        # Copy relationships and media files from original slide
        original_slide = shape.part

        
        # Copy media files and create custom relationships with same rIDs
        media_mappings = {}
        if has_relationships:
            for rel_id, rel in original_slide.rels.items():
                if 'media/' in rel.target_ref:
                    try:
                        # Copy media file to new presentation's media folder
                        media_part = rel.target_part
                        media_filename = os.path.basename(rel.target_ref)
                        
                        # Store mapping with original relationship ID
                        media_mappings[rel_id] = {
                            'filename': media_filename,
                            'blob': media_part.blob,
                            'content_type': media_part.content_type,
                            'target_ref': rel.target_ref
                        }
                    except Exception as e:
                        pass

        # Remove the default slide from the new presentation
        blank_slide_layout = export_prs.slide_layouts[6]
        export_slide = export_prs.slides.add_slide(blank_slide_layout)
        background = export_slide.background
        fill = background.fill
        fill.solid()  # Use solid fill
        # Use a unique magenta color that won't interfere with typical shape colors
        # This color will be removed later in remove_white_background function
        fill.fore_color.rgb = RGBColor(255, 0, 255)

        new_slide_element = export_slide._element
        spTree = new_slide_element.find(".//p:spTree", namespaces=new_slide_element.nsmap)
        spTree.append(shape_xml)
        setattr(shape, "left", 0)
        setattr(shape, "top", 0)
        setattr(shape, "width", scaled_width)
        setattr(shape, "height", scaled_height)
        # Set the slide size to match the grouped shape
        export_prs.slide_width = scaled_width
        export_prs.slide_height = scaled_height

        # Save the new presentation temporarily 
        temp_name = generate_random_string(16)
        temp_pptx = os.path.join(export_path, f"{temp_name}.pptx")
        temp_png = os.path.join(export_path, f"{temp_name}.png")

        export_prs.save(temp_pptx)

        # Add media files and relationships to the saved PPTX
        if media_mappings:
            create_media_relationships(temp_pptx, media_mappings)

        # Use LibreOffice to export
        if platform.system() == "Windows":
            command = [
                "soffice", "--headless", "--convert-to", "png", 
                "--outdir", export_path, temp_pptx
            ]
        else:
            command = [
                'sudo', '/usr/bin/soffice', "--headless", "--convert-to", "png",
                "--outdir", export_path, temp_pptx
            ]

        with open(os.devnull, 'w') as devnull:
            subprocess.run(command, stdout=devnull, stderr=devnull, check=True)
            
            
        # Move temp file to final destination
        if os.path.exists(temp_png):
            remove_white_background(temp_png, output_png)
            
            # Store in cache if valid
            if shape_id:
                exported_shapes[shape_id] = output_png

            # Cleanup temp files
            try:
                os.remove(temp_pptx)
                os.remove(temp_png)
            except:
                pass

            return output_png

    except Exception as e:
        pass
        # Cleanup on error
        try:
            if os.path.exists(temp_pptx):
                os.remove(temp_pptx)
            if os.path.exists(temp_png):
                os.remove(temp_png)
        except:
            pass
        return None

def create_media_relationships(pptx_path, media_mappings):
    """Create custom media relationships in the PPTX file"""
    
    try:
        # Create a temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            # Extract PPTX
            with zipfile.ZipFile(pptx_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            
            # Create media directory if it doesn't exist
            media_dir = os.path.join(temp_dir, 'ppt', 'media')
            os.makedirs(media_dir, exist_ok=True)
            
            # Copy media files
            for rel_info in media_mappings.values():
                media_path = os.path.join(media_dir, rel_info['filename'])
                with open(media_path, 'wb') as f:
                    f.write(rel_info['blob'])
            
            # Update slide relationships
            slide_rels_path = os.path.join(temp_dir, 'ppt', 'slides', '_rels', 'slide1.xml.rels')
            os.makedirs(os.path.dirname(slide_rels_path), exist_ok=True)
            
            # Create relationships XML with original rIDs
            relationships_xml = create_relationships_xml(media_mappings)
            with open(slide_rels_path, 'w', encoding='utf-8') as f:
                f.write(relationships_xml)
            
            # Update content types
            content_types_path = os.path.join(temp_dir, '[Content_Types].xml')
            update_content_types(content_types_path, media_mappings)
            
            # Recreate PPTX
            with zipfile.ZipFile(pptx_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arc_name = os.path.relpath(file_path, temp_dir)
                        zip_ref.write(file_path, arc_name)
                        
    except Exception as e:
        print(f"Error creating media relationships: {e}")

def create_relationships_xml(media_mappings):
    """Generate relationships XML for media files with original rIDs"""
    xml_header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    xml_start = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    xml_end = '</Relationships>'
    
    relationships = []
    
    for orig_rel_id, rel_info in media_mappings.items():
        # Use the original relationship ID and target reference
        rel_xml = f'<Relationship Id="{orig_rel_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/{rel_info["filename"]}"/>'
        relationships.append(rel_xml)
    
    return f"{xml_header}\n{xml_start}\n" + "\n".join(relationships) + f"\n{xml_end}"

def update_content_types(content_types_path, media_mappings):
    """Update [Content_Types].xml to include media file types"""
    try:
        # Read existing content types
        if os.path.exists(content_types_path):
            with open(content_types_path, 'r', encoding='utf-8') as f:
                content = f.read()
        else:
            content = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
        
        # Add media extensions if not present
        extensions_to_add = set()
        for rel_info in media_mappings.values():
            ext = os.path.splitext(rel_info['filename'])[1].lower()
            if ext in ['.png', '.jpg', '.jpeg', '.gif', '.bmp']:
                extensions_to_add.add(ext)
        
        # Insert extensions before closing tag
        for ext in extensions_to_add:
            ext_clean = ext.lstrip('.')
            content_type = f"image/{ext_clean}" if ext_clean != 'jpg' else "image/jpeg"
            ext_declaration = f'<Default Extension="{ext_clean}" ContentType="{content_type}"/>'
            
            if ext_declaration not in content:
                content = content.replace('</Types>', f'{ext_declaration}\n</Types>')
        
        # Write updated content types
        with open(content_types_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
    except Exception as e:
        print(f"Error updating content types: {e}")

def extract_paragraph_info(prs,object_data,paragraphs,shape,slide=None):
    for paragraph in paragraphs:
        bullet_char = None
        try:
            xml_content = etree.fromstring(sanitize_xml(tostring(paragraph._element, encoding='unicode', method='xml')))
            for elem in xml_content.iter():
                # Look for the <a:buChar> element which defines the bullet character
                if elem.tag.endswith('buChar'):  # XML namespace handling
                    bullet_char = elem.attrib.get('char') if elem.attrib.get('char') else '•'  # Get the bullet character
        except Exception as e:
                bullet_char = None
        # Resolve effective horizontal alignment. python-pptx's
        # `paragraph.alignment` only reads <a:pPr algn=...> on the
        # paragraph itself; title/body placeholders typically leave the
        # paragraph attr blank and inherit from the layout/master's
        # <a:lstStyle>/<a:lvlNpPr algn=...>. `get_effective_alignment`
        # walks that chain (matches how get_effective_font_size resolves
        # font size) and returns one of left|center|right|justify or None
        # if no algn is set anywhere.
        alignment = None
        try:
            if paragraph.alignment is not None:
                if isinstance(paragraph.alignment, int):
                    from pptx.enum.text import PP_PARAGRAPH_ALIGNMENT
                    alignment = str(PP_PARAGRAPH_ALIGNMENT(paragraph.alignment).name).lower()
                else:
                    alignment = str(paragraph.alignment.name).lower()
        except (ValueError, AttributeError, TypeError):
            alignment = None
        if alignment is None:
            try:
                alignment = get_effective_alignment(paragraph, shape, slide)
            except Exception:
                alignment = None
        if alignment is None:
            alignment = 'left'
                
        paragraph_data = {
                "text": paragraph.text, 
                "runs": [],
                "level": paragraph.level,
                "bullet": True if bullet_char is not None else False, 
                "bullet_char": bullet_char if bullet_char is not None else False,
                "alignment": alignment,
                "space_before": None,
                "space_after": None,
                "line_spacing": None,
                "indent": None,
        }

        # Extract paragraph spacing and indentation from pPr XML
        try:
            ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
            pPr_xml = etree.fromstring(sanitize_xml(tostring(paragraph._element, encoding='unicode', method='xml')))
            pPr = pPr_xml.find('a:pPr', namespaces=ns)
            if pPr is not None:
                # Space before paragraph
                spcBef = pPr.find('a:spcBef', namespaces=ns)
                if spcBef is not None:
                    spcPts = spcBef.find('a:spcPts', namespaces=ns)
                    if spcPts is not None:
                        # spcPts val is in hundredths of a point
                        paragraph_data["space_before"] = round(pt_to_px(int(spcPts.get('val', 0)) / 100.0), 2)
                    spcPct = spcBef.find('a:spcPct', namespaces=ns)
                    if spcPct is not None and paragraph_data["space_before"] is None:
                        # percentage-based — approximate as 0 (requires font size context)
                        paragraph_data["space_before"] = 0

                # Space after paragraph
                spcAft = pPr.find('a:spcAft', namespaces=ns)
                if spcAft is not None:
                    spcPts = spcAft.find('a:spcPts', namespaces=ns)
                    if spcPts is not None:
                        paragraph_data["space_after"] = round(pt_to_px(int(spcPts.get('val', 0)) / 100.0), 2)

                # Line spacing
                lnSpc = pPr.find('a:lnSpc', namespaces=ns)
                if lnSpc is not None:
                    spcPts = lnSpc.find('a:spcPts', namespaces=ns)
                    if spcPts is not None:
                        paragraph_data["line_spacing"] = f"{round(pt_to_px(int(spcPts.get('val', 0)) / 100.0), 2)}px"
                    spcPct = lnSpc.find('a:spcPct', namespaces=ns)
                    if spcPct is not None and paragraph_data["line_spacing"] is None:
                        pct_val = int(spcPct.get('val', 100000)) / 100000.0
                        paragraph_data["line_spacing"] = str(round(pct_val, 3))  # unitless multiplier

                # Indent (margin-left for indentation level)
                indent_attr = pPr.get('indent')
                marL_attr = pPr.get('marL')
                if marL_attr is not None:
                    paragraph_data["indent"] = emu_to_px(int(marL_attr))
        except Exception:
            pass
        # get the paragraph color from this xml
        paragraph_color = None
        try:
            xml_content = etree.fromstring(sanitize_xml(tostring(paragraph._element, encoding='unicode', method='xml')))
            namespaces = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
            
            # Look for paragraph color in endParaRPr element
            end_para_rpr = xml_content.find('.//a:endParaRPr', namespaces=namespaces)
            if end_para_rpr is not None:
                # Check for solid fill color
                solid_fill = end_para_rpr.find('.//a:solidFill/a:srgbClr', namespaces=namespaces)
                if solid_fill is not None:
                    paragraph_color = solid_fill.get('val')
                else:
                    # Check for theme color
                    theme_color = end_para_rpr.find('.//a:solidFill/a:schemeClr', namespaces=namespaces)
                    if theme_color is not None:
                        theme_val = theme_color.get('val')
                        # Convert theme color to actual color using the get_theme_colors function
                        paragraph_color = get_theme_colors(prs, theme_val)
            
            # If no color found in endParaRPr, check pPr element
            if paragraph_color is None:
                p_pr = xml_content.find('.//a:pPr', namespaces=namespaces)
                if p_pr is not None:
                    solid_fill = p_pr.find('.//a:solidFill/a:srgbClr', namespaces=namespaces)
                    if solid_fill is not None:
                        paragraph_color = solid_fill.get('val')
                    else:
                        theme_color = p_pr.find('.//a:solidFill/a:schemeClr', namespaces=namespaces)
                        if theme_color is not None:
                            theme_val = theme_color.get('val')
                            paragraph_color = get_theme_colors(prs, theme_val)
                            
        except Exception as e:
            paragraph_color = None
            
        # Check paragraph type from XML to identify titles, etc.
        paragraph_type = None
        try:
            # Extract the placeholder type (if available)
            xml_content = etree.fromstring(sanitize_xml(tostring(paragraph._element, encoding='unicode', method='xml')))
            shape_xml = shape.element
            
            # Get the nvPr element which contains placeholder information
            nv_pr = shape_xml.find('.//p:nvPr', namespaces={'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'})
            if nv_pr is not None:
                # Look for placeholder type
                placeholder = nv_pr.find('.//p:ph', namespaces={'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'})
                if placeholder is not None:
                    ph_type = placeholder.get('type')
                    paragraph_type = ph_type  # Could be 'title', 'subTitle', 'ctrTitle', etc.
        except Exception as e:
            # If there's an error parsing XML, set paragraph_type to None
            paragraph_type = None

        paragraph_data["placeholder_type"] = paragraph_type

        paragraph_data["color"] = paragraph_color if paragraph_color else "000000"
        
        for run in paragraph.runs:
            # Extract letter spacing from a:rPr spc attribute (hundredths of a point)
            letter_spacing_px = None
            try:
                # python-pptx exposes the run XML element as _r (not _element)
                run_el = getattr(run, '_r', None) or getattr(run, '_element', None)
                if run_el is not None:
                    # The rPr element is a direct child; find it with ns or without
                    NS_DRAW = 'http://schemas.openxmlformats.org/drawingml/2006/main'
                    rpr_el = run_el.find('{%s}rPr' % NS_DRAW)
                    if rpr_el is None:
                        rpr_el = run_el.find('a:rPr', namespaces=_NS_A)
                    if rpr_el is not None:
                        spc_raw = rpr_el.get('spc')
                        if spc_raw is not None:
                            spc_pt = int(spc_raw) / 100.0  # hundredths-of-pt → pt
                            try:
                                slide_h = int(prs.slide_height)
                            except Exception:
                                slide_h = 5143500  # default 16:9
                            letter_spacing_px = round(pt_to_canvas_px(spc_pt, slide_h), 2)
            except Exception:
                pass

            font_data = {
            "text": run.text,
            "font_name": run.font.name,
            "font_size": get_effective_font_size(run, paragraph, shape, slide, prs),
            "bold": run.font.bold,
            "italic": run.font.italic,
            "underline": run.font.underline,
            "letter_spacing": letter_spacing_px,
            "highlight": None,
            "color": None
            }
            
            # Extract text highlight color
            try:
                highlight_color = None
                # Try multiple methods to get the XML of the run
                xml_element = None
                
                # Method 1: Direct _element access
                if hasattr(run, '_element'):
                    xml_element = run._element
                
                # Method 2: Try accessing through text frame hierarchy
                if xml_element is None:
                    try:
                        # Get the paragraph's element and find the run
                        para_element = paragraph._element
                        runs = para_element.findall('.//a:r', namespaces={'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'})
                        if runs and len(runs) > paragraph.runs.index(run):
                            xml_element = runs[paragraph.runs.index(run)]
                    except:
                        pass
                
                # Method 3: Parse the paragraph XML and extract run elements
                if xml_element is None:
                    try:
                        para_xml_str = tostring(paragraph._element, encoding='unicode', method='xml')
                        para_xml = etree.fromstring(sanitize_xml(para_xml_str))
                        nsmap = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
                        run_elements = para_xml.findall('.//a:r', namespaces=nsmap)
                        run_index = list(paragraph.runs).index(run)
                        if run_index < len(run_elements):
                            xml_element = run_elements[run_index]
                    except:
                        pass
                
                # Method 4: Direct XML parsing from shape element
                if xml_element is None:
                    try:
                        shape_xml_str = tostring(shape.element, encoding='unicode', method='xml')
                        shape_xml = etree.fromstring(sanitize_xml(shape_xml_str))
                        nsmap = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
                        all_runs = shape_xml.findall('.//a:r', namespaces=nsmap)
                        # Find the run by matching text content
                        for run_elem in all_runs:
                            t_elem = run_elem.find('.//a:t', namespaces=nsmap)
                            if t_elem is not None and t_elem.text == run.text:
                                xml_element = run_elem
                                break
                    except:
                        pass
                
                if xml_element is not None:
                    try:
                        # Use proper namespace handling for XML elements
                        nsmap = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
                        
                        # Get rPr (run properties) element
                        rPr = xml_element.find('./a:rPr', namespaces=nsmap)
                        
                        if rPr is not None:
                            # Look for highlight element
                            highlight = rPr.find('./a:highlight', namespaces=nsmap)
                            
                            if highlight is not None:
                                # Check for RGB color
                                srgb_clr = highlight.find('./a:srgbClr', namespaces=nsmap)
                                if srgb_clr is not None:
                                    highlight_color = srgb_clr.get('val')
                                else:
                                    # Check for theme color
                                    scheme_clr = highlight.find('./a:schemeClr', namespaces=nsmap)
                                    if scheme_clr is not None:
                                        theme_val = scheme_clr.get('val')
                                        highlight_color = get_theme_colors(prs, theme_val)
                        
                        font_data["highlight"] = highlight_color
                    except Exception as e:
                        font_data["highlight"] = None
                else:
                    font_data["highlight"] = None
            except Exception as e:
                # Silently continue if we can't extract highlight info
                font_data["highlight"] = None
            # Resolve via the full placeholder cascade — run rPr is just
            # step 1 of 6. Without this, inherited-color runs (e.g. a
            # title that derives accent1 from the master's titleStyle)
            # would land here with `str(None) == "None"` and render as the
            # editor's default black. See get_effective_font_color above.
            effective_color = get_effective_font_color(run, paragraph, shape, slide, prs)
            if effective_color:
                font_data["color"] = effective_color
            elif run.font.color and isinstance(run.font.color, _NoneColor):
                font_data["color"] = "No color"
            else:
                font_data["color"] = paragraph_data["color"]
            paragraph_data["runs"].append(font_data)
        object_data["paragraph"].append(paragraph_data)
        object_data["text"].append(paragraph.text)

def is_shape_hidden(shape):
    """Check if a shape is hidden using PowerPoint visibility attributes."""
    try:
        # PowerPoint XML namespaces
        nsmap = {
            'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
            'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'
        }
        
        element = shape.element

        # Check for explicit hidden flags in the shape properties
        hidden = False

        # Check for nvSpPr (non-visual shape properties)
        nvSpPr_props = element.find('.//p:nvSpPr/p:cNvPr', namespaces=nsmap)
        if nvSpPr_props is not None:
            hidden = nvSpPr_props.get('hidden') == '1'

        # Check for nvPicPr (non-visual picture properties)
        nvPicPr_props = element.find('.//p:nvPicPr/p:cNvPr', namespaces=nsmap)
        if nvPicPr_props is not None:
            hidden = hidden or nvPicPr_props.get('hidden') == '1'

        # Return true if any hiding condition is met
        return hidden or shape.width == 0 or shape.height == 0

    except Exception as e:
        # If there's an error, assume the shape is visible
        return False

def get_crop_data(shape, slide_width, slide_height):
    """Extract crop data from a picture shape and convert to base unit (1920x1080)."""
    try:
        blip_fill = shape.element.find(
            './/p:blipFill',
            namespaces={'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
        )
        
        if blip_fill is not None:
            stretch = blip_fill.find(
                './/a:srcRect',
                namespaces={'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
            )
            
            if stretch is not None and hasattr(shape, 'image'):
                with Image.open(BytesIO(shape.image.blob)) as img:
                    orig_width, orig_height = img.size

                # Convert crop percentage to pixels first
                def get_crop_px(value, dimension):
                    if value:
                        return int(int(value) / 100000 * dimension)
                    return 0

                # Get crop values in pixels
                crop_px = {
                    "left": get_crop_px(stretch.get('l'), orig_width),
                    "right": get_crop_px(stretch.get('r'), orig_width),
                    "top": get_crop_px(stretch.get('t'), orig_height),
                    "bottom": get_crop_px(stretch.get('b'), orig_height)
                }
                # Convert to base unit (1920x1080)
                if any(crop_px.values()):
                    crop_base = {
                        "left": crop_px["left"],
                        "right":  crop_px["right"],
                        "top": crop_px["top"],
                        "bottom": crop_px["bottom"],
                        "width": orig_width,
                        "height": orig_height
                    }
                    return crop_base
    except Exception as e:
        pass
    return None

# ────────────────────────────────────────────────────────────────────
# Chart extraction
#
# python-pptx exposes the underlying chart XML; we map the four chart types
# we support client-side (bar/line/area/pie) and fall through to image
# export for everything else (combo, scatter, radar, 3D variants). Stack
# and donut flags are derived from the same chart_type enum.
# ────────────────────────────────────────────────────────────────────

_CHART_BAR_TYPES = {
    'BAR_CLUSTERED', 'BAR_STACKED', 'BAR_STACKED_100',
    'COLUMN_CLUSTERED', 'COLUMN_STACKED', 'COLUMN_STACKED_100',
    'THREE_D_BAR_CLUSTERED', 'THREE_D_BAR_STACKED', 'THREE_D_BAR_STACKED_100',
    'THREE_D_COLUMN_CLUSTERED', 'THREE_D_COLUMN_STACKED', 'THREE_D_COLUMN_STACKED_100',
}
_CHART_BAR_STACKED = {
    'BAR_STACKED', 'BAR_STACKED_100',
    'COLUMN_STACKED', 'COLUMN_STACKED_100',
    'THREE_D_BAR_STACKED', 'THREE_D_BAR_STACKED_100',
    'THREE_D_COLUMN_STACKED', 'THREE_D_COLUMN_STACKED_100',
}
_CHART_LINE_TYPES = {
    'LINE', 'LINE_MARKERS',
    'LINE_STACKED', 'LINE_STACKED_100',
    'LINE_MARKERS_STACKED', 'LINE_MARKERS_STACKED_100',
    'THREE_D_LINE',
}
_CHART_AREA_TYPES = {
    'AREA', 'AREA_STACKED', 'AREA_STACKED_100',
    'THREE_D_AREA', 'THREE_D_AREA_STACKED', 'THREE_D_AREA_STACKED_100',
}
_CHART_AREA_STACKED = {
    'AREA_STACKED', 'AREA_STACKED_100',
    'THREE_D_AREA_STACKED', 'THREE_D_AREA_STACKED_100',
}
_CHART_PIE_TYPES = {
    'PIE', 'PIE_EXPLODED', 'THREE_D_PIE', 'THREE_D_PIE_EXPLODED',
    'DOUGHNUT', 'DOUGHNUT_EXPLODED',
}
_CHART_DONUT = {'DOUGHNUT', 'DOUGHNUT_EXPLODED'}


def _map_chart_type(chart_type_name):
    """Return (chartType, stacked, donut) tuple.

    Bar / line / area / pie map to their native client chartType. Every
    other PowerPoint chart type (radar, bubble, surface, scatter, combo,
    etc.) coerces to a structured bar chart of the same data — bar is the
    universal catch-all so an imported chart is never rasterized or
    dropped as long as its data extracts. (The downstream no-data guard in
    extract_chart_data still falls back to an image for charts that yield
    no usable categories/values.)
    """
    if chart_type_name in _CHART_LINE_TYPES:
        return ('line', False, False)
    if chart_type_name in _CHART_AREA_TYPES:
        return ('area', chart_type_name in _CHART_AREA_STACKED, False)
    if chart_type_name in _CHART_PIE_TYPES:
        return ('pie', False, chart_type_name in _CHART_DONUT)
    # Bar types and the catch-all both land here.
    return ('bar', chart_type_name in _CHART_BAR_STACKED, False)


def _extract_series_color(series_xml):
    """Pull the series fill color from the chart XML, if explicitly set.

    Returns a #RRGGBB hex string or None. Auto-themed series (no explicit
    fill) return None so the client falls back to deck-palette colors.
    """
    if series_xml is None:
        return None
    ns = {
        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
        'c': 'http://schemas.openxmlformats.org/drawingml/2006/chart',
    }
    try:
        srgb = series_xml.find('.//c:spPr//a:solidFill/a:srgbClr', namespaces=ns)
        if srgb is not None:
            val = srgb.get('val')
            if val and len(val) == 6:
                return f'#{val.upper()}'
    except Exception:
        pass
    return None


def extract_chart_data(shape):
    """Extract chart data from a shape, return dict matching ChartElement schema or None.

    Returns None for unsupported chart types (combo, scatter, radar, 3D non-mapped).
    The caller falls back to image export so the slide still has a visual.
    """
    if not getattr(shape, 'has_chart', False):
        return None
    try:
        chart = shape.chart
        chart_type_name = str(chart.chart_type).split('.')[-1].split(' ')[0]
        mapping = _map_chart_type(chart_type_name)
        if mapping is None:
            return None
        chart_type, stacked, donut = mapping

        plot = chart.plots[0]

        # Categories. python-pptx returns these via the plot's category axis;
        # numeric categories (e.g. years) are stringified for the client which
        # treats categories as labels.
        try:
            categories = []
            for c in plot.categories:
                if c is None:
                    categories.append('')
                else:
                    categories.append(str(c))
        except Exception:
            categories = []

        # Series. Each gets a stable id, label, parsed values (number-or-null
        # for gaps), and an optional explicit color from the chart XML.
        series_data = []
        for series_idx, series in enumerate(plot.series):
            try:
                label = str(series.name) if series.name else f'Series {series_idx + 1}'
            except Exception:
                label = f'Series {series_idx + 1}'

            values = []
            try:
                for v in series.values:
                    if v is None:
                        values.append(None)
                        continue
                    try:
                        f = float(v)
                        if f != f:  # NaN
                            values.append(None)
                        else:
                            values.append(f)
                    except (TypeError, ValueError):
                        values.append(None)
            except Exception:
                values = [None] * len(categories)

            # Fill in any missing tail so values length matches categories.
            while len(values) < len(categories):
                values.append(None)

            color = _extract_series_color(getattr(series, '_element', None))

            entry = {
                'id': f's{series_idx}',
                'label': label,
                'values': values,
            }
            if color:
                entry['color'] = color
            series_data.append(entry)

        # Reject extractions that yielded no usable data — categories empty
        # or every series has no values. A "successful" empty chart looks
        # broken to the user; falling through to image export gives them at
        # least the rendered visual from the original PPTX.
        has_any_value = any(
            any(v is not None for v in s['values']) for s in series_data
        )
        if not series_data or not categories or not has_any_value:
            print(
                f'[Parser] Chart extraction yielded empty data '
                f'(categories={len(categories)}, series={len(series_data)}, '
                f'has_values={has_any_value}, type={chart_type_name}); '
                f'falling back to image export',
                file=sys.stderr,
            )
            return None

        # Title — only when explicitly set on the chart.
        title = None
        try:
            if chart.has_title:
                title_text = chart.chart_title.text_frame.text
                if title_text and title_text.strip():
                    title = title_text.strip()
        except Exception:
            title = None

        result = {
            'chartType': chart_type,
            'data': {
                'categories': categories,
                'series': series_data,
            },
        }
        if stacked:
            result['stacked'] = True
        if donut:
            result['donut'] = True
        if title:
            result['title'] = title
        print(
            f'[Parser] Chart extracted: type={chart_type} '
            f'({len(categories)} categories x {len(series_data)} series)',
            file=sys.stderr,
        )
        return result
    except Exception as e:
        print(f'[Parser] Chart extraction failed: {e}', file=sys.stderr)
        return None


def extract_objects_from_ppt(file_path, media_folder, selected_slides=None):
    prs = Presentation(file_path)
    presentation_data = []

        # Get slide properties
    slide_properties = get_slide_properties(prs)

    # If no selected slides specified or empty list, process all slides
    if selected_slides is None or len(selected_slides) == 0:
        selected_slides = list(range(1, len(prs.slides) + 1))

    for slide_idx, slide in enumerate(prs.slides):
        # Skip slides that are not in the selected_slides list
        current_slide_number = slide_idx + 1
        if current_slide_number not in selected_slides:
            continue
        slide_layout_name = slide.slide_layout.name
        slide_data = {
            "slide_number": slide_idx + 1,
            "slide_layout":f"layout_{slide_layout_name.replace(' ', '_')}.png",
            "properties": slide_properties[slide_idx],
            "background": get_slide_background(prs, slide, media_folder, slide_idx),
            "objects": [],

        }

        # Flatten group shapes so nested filled shapes (which python-pptx
        # exposes only via `group.shapes`) are processed by the same
        # branches as top-level shapes. Without this, decks that use
        # groups for decorative geometry (every PowerPoint template made
        # in the last decade) end up with empty / transparent shapes
        # where their filled children should be.
        #
        # Children inside a group are positioned in the group's local
        # coordinate system, which the group itself maps onto the slide
        # via `<a:xfrm>` `off` / `ext` (slide-side bounds) + `chOff` /
        # `chExt` (child-side bounds). Modern PowerPoint templates use
        # large scale factors here (6×–7× is common for "decorative
        # geometry pack" groups) — applying offset alone would land the
        # shape on the slide but at a tiny fraction of its intended size.
        #
        # We accumulate (off_x, off_y, scale_x, scale_y) through the
        # recursion. For a leaf at local (lx, ly):
        #   slide_x = off_x + lx * scale_x
        #   slide_y = off_y + ly * scale_y
        #   slide_w =          lw * scale_x
        #   slide_h =          lh * scale_y
        # The composition entering a new group G is:
        #   new_off   = off + (G.off - G.chOff * G.scale) * scale
        #   new_scale = scale * G.scale
        # which collapses to identity for an unscaled child of the slide.
        NS_A_LOCAL = "http://schemas.openxmlformats.org/drawingml/2006/main"

        # 2D affine matrix helpers — kept inline so the slide loop stays
        # self-contained. The matrix is a 6-tuple (a, b, c, d, e, f)
        # representing [a c e ; b d f ; 0 0 1] so M @ (x,y,1) maps a
        # point in the inner-most group's local coords to slide-absolute
        # EMU. Identity is no-op. We need this (instead of the old
        # off/scale pair) to thread group rotation through to the leaves
        # — without it, a rotated group's children land at unrotated
        # positions in the imported slide.
        def _m_identity():
            return (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

        def _m_mul(m1, m2):
            a1, b1, c1, d1, e1, f1 = m1
            a2, b2, c2, d2, e2, f2 = m2
            return (
                a1 * a2 + c1 * b2,
                b1 * a2 + d1 * b2,
                a1 * c2 + c1 * d2,
                b1 * c2 + d1 * d2,
                a1 * e2 + c1 * f2 + e1,
                b1 * e2 + d1 * f2 + f1,
            )

        def _m_translate(tx, ty):
            return (1.0, 0.0, 0.0, 1.0, float(tx), float(ty))

        def _m_scale(sx, sy):
            return (float(sx), 0.0, 0.0, float(sy), 0.0, 0.0)

        def _m_rotate(rad):
            import math as _mm
            cs, sn = _mm.cos(rad), _mm.sin(rad)
            return (cs, sn, -sn, cs, 0.0, 0.0)

        def _m_apply(m, x, y):
            a, b, c, d, e, f = m
            return (a * x + c * y + e, b * x + d * y + f)

        def _m_decompose(m):
            """Return (scale_x, scale_y, rotation_rad). Assumes uniform
            sign-preserving scaling and a pure rotation — both hold for
            PowerPoint group transforms (no skew, no negative scale)."""
            import math as _mm
            a, b, c, d, _e, _f = m
            sx = _mm.sqrt(a * a + b * b) or 1.0
            sy = _mm.sqrt(c * c + d * d) or 1.0
            rot = _mm.atan2(b, a)
            return sx, sy, rot

        def _group_xfrm(grp):
            """Return the group's local→parent transform as an affine
            matrix. Group transform is:
                T(off) ∘ T(ext/2) ∘ R(rot) ∘ T(-ext/2) ∘ S(ext/chExt) ∘ T(-chOff)
            i.e. shift child-local origin → scale to fit ext → rotate
            around the group's center → translate to the group's slide
            position."""
            sp = grp.element
            xfrm = sp.find(f".//{{{NS_A_LOCAL}}}xfrm")
            if xfrm is None:
                return _m_identity()
            off = xfrm.find(f"{{{NS_A_LOCAL}}}off")
            ext = xfrm.find(f"{{{NS_A_LOCAL}}}ext")
            choff = xfrm.find(f"{{{NS_A_LOCAL}}}chOff")
            chext = xfrm.find(f"{{{NS_A_LOCAL}}}chExt")
            off_x = off_y = 0
            choff_x = choff_y = 0
            ex = ey = 0
            cex = cey = 1
            try:
                if off is not None:
                    off_x = int(off.get("x", "0"))
                    off_y = int(off.get("y", "0"))
                if choff is not None:
                    choff_x = int(choff.get("x", "0"))
                    choff_y = int(choff.get("y", "0"))
                if ext is not None:
                    ex = int(ext.get("cx", "0"))
                    ey = int(ext.get("cy", "0"))
                if chext is not None:
                    cex = int(chext.get("cx", "0")) or 1
                    cey = int(chext.get("cy", "0")) or 1
            except Exception:
                pass
            sx = (ex / cex) if cex else 1.0
            sy = (ey / cey) if cey else 1.0
            rot_raw = xfrm.get('rot')
            rot = 0.0
            if rot_raw:
                try:
                    import math as _mm
                    rot = _mm.radians(int(rot_raw) / 60000.0)
                except Exception:
                    rot = 0.0
            cx = ex / 2.0
            cy = ey / 2.0
            m = _m_translate(off_x, off_y)
            m = _m_mul(m, _m_translate(cx, cy))
            if rot:
                m = _m_mul(m, _m_rotate(rot))
            m = _m_mul(m, _m_translate(-cx, -cy))
            m = _m_mul(m, _m_scale(sx, sy))
            m = _m_mul(m, _m_translate(-choff_x, -choff_y))
            return m

        def _flatten_shapes(container, m_parent=None):
            if m_parent is None:
                m_parent = _m_identity()
            for sh in container:
                if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
                    yield from _flatten_shapes(
                        sh.shapes, _m_mul(m_parent, _group_xfrm(sh))
                    )
                else:
                    yield (sh, m_parent)

        # Inherited decorations — non-placeholder shapes from the slide
        # master and layout (logos, decorative bars, framing graphics).
        # These render on every slide that uses the layout/master in
        # PPT but aren't part of `slide.shapes`. Yield them BEFORE the
        # slide's own shapes so they sit at the bottom of the z-stack.
        # Placeholders are skipped — the slide already supplies its own
        # placeholder content via the per-slide shapes iteration.
        def _inherited_shapes():
            for src_container in (
                slide.slide_layout.slide_master.shapes,
                slide.slide_layout.shapes,
            ):
                for sh, m in _flatten_shapes(src_container):
                    try:
                        if sh.is_placeholder:
                            continue
                    except Exception:
                        pass
                    yield sh, m

        all_shapes = list(_inherited_shapes()) + list(_flatten_shapes(slide.shapes))
        for shape_idx, (shape, _grp_m) in enumerate(all_shapes):
            # Skip hidden shapes
            if is_shape_hidden(shape):
                continue

            # SmartArt — `<p:graphicFrame>` with a `<dgm:relIds>` child.
            # python-pptx exposes the frame as a shape but doesn't
            # decompose the diagram, so we walk the cached visual
            # rendering at `ppt/diagrams/drawing*.xml` ourselves. Detect
            # by element shape (tag + child) rather than `shape_type`
            # because the frame is often also flagged as a placeholder
            # (typenum 14), which would otherwise short-circuit our
            # check.  Charts and tables share the graphicFrame tag so
            # we explicitly require the `<dgm:relIds>` discriminator.
            try:
                el = shape.element
                NS_DGM = '{http://schemas.openxmlformats.org/drawingml/2006/diagram}'
                is_diagram = (
                    el.tag.endswith('}graphicFrame')
                    and el.find(f'.//{NS_DGM}relIds') is not None
                )
            except Exception:
                is_diagram = False
            if is_diagram:
                try:
                    smart_objs = _extract_smartart_objects(shape, slide, prs, media_folder)
                except Exception as ex:
                    print(f"[Parser] SmartArt extraction failed: {ex}", file=sys.stderr)
                    smart_objs = []
                for so in smart_objs:
                    slide_data['objects'].append(so)
                continue
                
            # Apply the accumulated group transform (offset + scale +
            # rotation around each ancestor group's centre) to land the
            # leaf in slide coordinates at its intended size and angle.
            # Top-level shapes pass through untouched because m=identity.
            #
            # Strategy: transform the leaf's CENTRE through the matrix to
            # get the rotated slide-coord centre, then derive the bounding
            # box around that centre using the matrix-decomposed scale.
            # The leaf's own rotation (`shape.rotation`) is added to the
            # matrix's rotation angle below — together they form the
            # final element rotation. This matches PowerPoint's nested-
            # group semantics (each enclosing rotated group adds its
            # rotation to the child).
            _raw_left = getattr(shape, "left", None)
            _raw_top = getattr(shape, "top", None)
            _raw_w = getattr(shape, "width", None)
            _raw_h = getattr(shape, "height", None)
            _abs_left = _abs_top = _abs_w = _abs_h = None
            _inherited_rot_deg = 0.0
            if _raw_left is not None and _raw_top is not None and _raw_w and _raw_h:
                grp_sx, grp_sy, grp_rot = _m_decompose(_grp_m)
                _abs_w = int(_raw_w * grp_sx)
                _abs_h = int(_raw_h * grp_sy)
                # Centre of the leaf in inner-most-group local coords,
                # then transformed through the cumulative matrix.
                local_cx = _raw_left + _raw_w / 2.0
                local_cy = _raw_top + _raw_h / 2.0
                slide_cx, slide_cy = _m_apply(_grp_m, local_cx, local_cy)
                _abs_left = int(slide_cx - _abs_w / 2)
                _abs_top = int(slide_cy - _abs_h / 2)
                import math as _mm_loop
                _inherited_rot_deg = _mm_loop.degrees(grp_rot)
            object_data = {
                "name": shape.name if hasattr(shape, "name") else "Unnamed",
                "type": type(shape).__name__,
                "typenum": shape.shape_type,
                "position_emus": {
                    "left": _abs_left,
                    "top": _abs_top,
                    "width": _abs_w,
                    "height": _abs_h,
                },
                # Final rotation = the leaf's own rotation plus the
                # rotation inherited from every enclosing group. Without
                # the inherited term, leaves of a rotated group land at
                # the rotated position (matrix above) but display
                # un-rotated, which doesn't match the source rendering.
                "rotation": (
                    (getattr(shape, "rotation", 0) or 0) + _inherited_rot_deg
                ),
                "text": [],
                "paragraph": [],
                "fill": None,
                "line": None
            }

            # <p:cNvPr id="N"> — the integer `<p:spTgt spid="N"/>` in
            # <p:timing> references. Lives under <p:nvSpPr> / <p:nvPicPr> /
            # <p:nvGraphicFramePr> depending on shape kind; the first
            # cNvPr under the shape element is always the non-visual root.
            try:
                cnvpr = shape.element.find(
                    './/p:cNvPr',
                    namespaces={'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'},
                )
                if cnvpr is not None and cnvpr.get('id'):
                    object_data['nvspr_id'] = int(cnvpr.get('id'))
            except Exception:
                pass

            # Extract flip_v and flip_h from shape XML
            try:
                shape_xml = shape.element
                # Use namespace-aware searching for xfrm element
                nsmap = {
                    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
                    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'
                }
                # Try common paths where xfrm might be located
                xfrm = shape_xml.find('.//p:xfrm', namespaces=nsmap)
                if xfrm is None:
                    xfrm = shape_xml.find('.//a:xfrm', namespaces=nsmap)
                
                if xfrm is not None:
                    # Extract flip attributes from xfrm element
                    flip_v = xfrm.get('flipV')
                    flip_h = xfrm.get('flipH')
                    
                    if flip_v == '1':
                        object_data["flip_v"] = True
                        
                    if flip_h == '1':
                        object_data["flip_h"] = True
            except Exception as e:
                # If there's an error in extraction, don't add flip properties
                pass
            
            # Calculate position in pixels
            if object_data["position_emus"]["left"] is not None:
                object_data["position"] = {
                    "left": convert_to_base_unit(1920,emu_to_px(slide_data['properties']['width']),emu_to_px(object_data["position_emus"]["left"])),
                    "top": convert_to_base_unit(1080,emu_to_px(slide_data['properties']['height']),emu_to_px(object_data["position_emus"]["top"])),
                    "width": convert_to_base_unit(1920,emu_to_px(slide_data['properties']['width']),emu_to_px(object_data["position_emus"]["width"])),
                    "height": convert_to_base_unit(1080,emu_to_px(slide_data['properties']['height']),emu_to_px(object_data["position_emus"]["height"])),
                }

            # ── Preset geometry ──
            # PowerPoint's `<a:prstGeom prst="…">` lets us tell rect from
            # ellipse from triangle. Without this every shape would get
            # rendered as a rectangle on import. Corner radius is also
            # encoded here for roundRect-family presets — see
            # extract_corner_radius for the conversion math.
            try:
                preset = extract_preset_name(shape)
                # Freeform picture-fills (the common circular-profile
                # pattern in modern .pptx) carry no <a:prstGeom>; lift a
                # synthetic 'ellipse' preset when the custGeom path is
                # all-curves so the converter applies the round mask.
                if not preset and is_custgeom_ellipse_like(shape):
                    preset = "ellipse"
                if preset:
                    object_data["preset_geometry"] = preset
                cr = extract_corner_radius(
                    shape,
                    object_data.get("position", None),
                )
                if cr is not None:
                    object_data["corner_radius"] = cr
            except Exception:
                # Best-effort — never break the import if a single shape's
                # geometry XML is malformed.
                pass

            # ── Chart detection ──
            # Charts are GraphicFrame shapes with shape.has_chart == True.
            # Supported chart types map to a 'Chart' object that the Node
            # converter turns into a ChartElement. Unsupported chart types
            # (combo, scatter, radar) fall through to the existing
            # GraphicFrame branch below, which exports them as images so
            # the slide still has visual content.
            if getattr(shape, 'has_chart', False):
                chart_data = extract_chart_data(shape)
                if chart_data is not None:
                    object_data['type'] = 'Chart'
                    object_data['chart'] = chart_data
                    slide_data['objects'].append(object_data)
                    continue

            # Extract text and font styling
            if shape.has_text_frame:
                extract_paragraph_info(prs,object_data, shape.text_frame.paragraphs,shape,slide)
                # Extract text frame vertical alignment and padding (1C)
                try:
                    tf = shape.text_frame
                    anchor = tf.vertical_anchor
                    if anchor is not None:
                        anchor_str = str(anchor).lower()
                        if 'middle' in anchor_str or 'center' in anchor_str:
                            object_data["text_anchor"] = "middle"
                        elif 'bottom' in anchor_str:
                            object_data["text_anchor"] = "bottom"
                        else:
                            object_data["text_anchor"] = "top"
                    else:
                        object_data["text_anchor"] = "top"
                except Exception:
                    object_data["text_anchor"] = "top"
                try:
                    tf = shape.text_frame
                    object_data["padding_left"]   = round(emu_to_px(tf.margin_left),   2) if tf.margin_left   is not None else 0
                    object_data["padding_top"]    = round(emu_to_px(tf.margin_top),    2) if tf.margin_top    is not None else 0
                    object_data["padding_right"]  = round(emu_to_px(tf.margin_right),  2) if tf.margin_right  is not None else 0
                    object_data["padding_bottom"] = round(emu_to_px(tf.margin_bottom), 2) if tf.margin_bottom is not None else 0
                except Exception:
                    object_data["padding_left"] = object_data["padding_top"] = 0
                    object_data["padding_right"] = object_data["padding_bottom"] = 0


            # Handle shapes with a fill attribute. We probe for a
            # picture fill (`<a:blipFill>` directly under `<p:spPr>`)
            # *before* trusting `shape.fill.type` — python-pptx's
            # `_FillFormat` doesn't reliably return MSO_FILL.PICTURE for
            # autoshapes that use a blipFill (it often returns
            # `MSO_FILL.BACKGROUND` or raises), and we'd otherwise lose
            # the image entirely.
            picture_fill_filename = None
            if not object_data.get("image"):
                try:
                    picture_fill_filename = extract_shape_picture_fill(
                        shape, media_folder
                    )
                except Exception as ex:
                    print(
                        f"[Parser] picture-fill probe failed: {ex}",
                        file=sys.stderr,
                    )
            if picture_fill_filename:
                object_data["image"] = picture_fill_filename
                object_data["type"] = "Picture"
                object_data["fill"] = {"type": "picture"}
            elif hasattr(shape, 'fill'):
                if shape.fill and shape.fill.type == 1:  # Solid fill
                    fill_color = shape.fill.fore_color
                    # Pull <a:alpha> from the shape XML so semi-
                    # transparent solid fills (e.g. PPT decorative
                    # circle at 30% opacity) round-trip as 8-digit
                    # hex (#RRGGBBAA) — SVG fill + CSS both accept it.
                    fill_alpha = None
                    try:
                        fill_alpha = _solid_fill_alpha(shape.element)
                    except Exception:
                        fill_alpha = None
                    try:
                        rgb = str(fill_color.rgb) if fill_color.rgb else None
                        object_data["fill"] = {
                            "type": "solid",
                            "color": _hex_with_alpha(rgb, fill_alpha) if rgb else "No Fill"
                        }
                    except Exception as e:
                        if isinstance(fill_color, RGBColor):
                            rgb = str(fill_color.rgb) if fill_color.rgb else None
                            object_data["fill"] = {
                                "type": "solid",
                                "color": _hex_with_alpha(rgb, fill_alpha) if rgb else "No Fill"
                            }
                        elif hasattr(fill_color, "theme_color"):
                            # Resolve theme color to actual hex
                            resolved = get_theme_colors(prs, fill_color.theme_color)
                            object_data["fill"] = {
                                "type": "solid",
                                "color": _hex_with_alpha(resolved, fill_alpha) if resolved else "No Fill"
                            }
                        else:
                            object_data["fill"] = {"type": "none"}
                elif shape.fill and shape.fill.type == 2:  # Gradient fill
                    # Extract gradient details via XML for CSS-compatible output
                    gradient_data = {"type": "gradient", "stops": [], "angle": 0}
                    try:
                        # Access raw XML of the shape fill
                        ns_a = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
                        sp_xml = etree.fromstring(sanitize_xml(tostring(shape.element, encoding='unicode', method='xml')))
                        grad_fill = sp_xml.find('.//a:gradFill', namespaces=ns_a)
                        if grad_fill is not None:
                            # Gradient angle: stored as 60000ths of a degree in a:lin
                            lin_el = grad_fill.find('.//a:lin', namespaces=ns_a)
                            if lin_el is not None:
                                ang_raw = lin_el.get('ang', '0')
                                gradient_data["angle"] = round(int(ang_raw) / 60000.0, 2)

                            # Gradient stops
                            for gs_el in grad_fill.findall('.//a:gs', namespaces=ns_a):
                                pos_raw = gs_el.get('pos', '0')
                                pos_pct = int(pos_raw) / 1000  # thousandths of percent → percent
                                # Colour inside gs
                                clr_color = None
                                srgb = gs_el.find('.//a:srgbClr', namespaces=ns_a)
                                if srgb is not None:
                                    clr_color = srgb.get('val')
                                else:
                                    scheme = gs_el.find('.//a:schemeClr', namespaces=ns_a)
                                    if scheme is not None:
                                        clr_color = get_theme_colors(prs, scheme.get('val'))
                                    else:
                                        sys_clr = gs_el.find('.//a:sysClr', namespaces=ns_a)
                                        if sys_clr is not None:
                                            clr_color = sys_clr.get('lastClr', '000000')
                                if clr_color:
                                    gradient_data["stops"].append({
                                        "color": clr_color,
                                        "position": pos_pct
                                    })
                    except Exception as grad_error:
                        print(f"[Parser] Gradient extraction error: {grad_error}", file=sys.stderr)
                    object_data["fill"] = gradient_data
                else:
                    object_data["fill"] = {"type": "none"}
            else:
                object_data["fill"] = {"type": "none"}  # No fill for shapes that don't have a fill attribute

            # Extract line information by walking the shape XML directly.
            # python-pptx's `shape.line.color.rgb` raises for theme colours,
            # stringifies the enum unhelpfully, and ignores style references
            # (<p:style>/<a:lnRef>) entirely — which is how PPT stores
            # outlines for shapes picked from the style gallery, including
            # most dashed-frame "callout" rectangles. _resolve_line_xml
            # walks <p:spPr>/<a:ln> first and falls back to <p:style>/
            # <a:lnRef> with theme lookup. Width comes from either
            # python-pptx (when set on the shape) or the resolved theme
            # ln's `w` attribute.
            if hasattr(shape, "line"):
                resolved = _resolve_line_xml(shape.element, prs)
                line_color = resolved["color"] or "No Line"
                line_dash = resolved["dash"]
                line_width = None
                try:
                    line_width = shape.line.width if shape.line.width else None
                except Exception:
                    line_width = None
                if line_width is None:
                    line_width = resolved["width"]
                object_data["line"] = {
                    "color": line_color,
                    "width": line_width,
                    **({"dash": line_dash} if line_dash else {}),
                }

            # Extract table data (if the shape is a table)
            if shape.shape_type == 19:  # Shape type for tables
                table = shape.table
                row_count = len(table.rows)
                col_count = len(table.columns)
                visited = [[False] * col_count for _ in range(row_count)]
                table_data = []

                for r in range(row_count):
                    row_data = []
                    for c in range(col_count):
                        if visited[r][c]:
                            row_data.append({
                                "text": "",
                                "background_color": None,
                                "font_color": None,
                                "font_size": None,
                                "font_name": None,
                                "bold": None,
                                "italic": None,
                                "rowspan": 0,
                                "colspan": 0,
                                "width_emus": 0,
                                "width": 0
                            })
                            continue

                        cell = table.cell(r, c)
                        rowspan = 1
                        colspan = 1

                        # Read span info from XML (rowSpan/gridSpan)
                        try:
                            tc_xml = etree.fromstring(cell._tc.xml)
                            # gridSpan is usually on the <a:tc> element; rowSpan is usually on <a:tcPr>
                            grid_span = tc_xml.get('gridSpan')
                            ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
                            tcPr = tc_xml.find('.//a:tcPr', namespaces=ns)
                            row_span = None
                            if tcPr is not None:
                                row_span = tcPr.get('rowSpan')
                                # Some generators may also put gridSpan on tcPr; honor it if root doesn't have it
                                if grid_span is None:
                                    grid_span = tcPr.get('gridSpan')

                            if row_span is not None:
                                try:
                                    rowspan = int(row_span)
                                except Exception:
                                    pass
                            if grid_span is not None:
                                try:
                                    colspan = int(grid_span)
                                except Exception:
                                    pass
                        except Exception:
                            pass

                        # Compute cell width (sum of column widths across colspan)
                        try:
                            start_col = c
                            end_col = min(c + colspan, col_count)
                            cell_width_emus = sum(int(table.columns[i].width or 0) for i in range(start_col, end_col))
                            cell_width_px = emu_to_px(cell_width_emus)
                        except Exception:
                            cell_width_emus = 0
                            cell_width_px = 0

                        cell_data = {
                            "text": cell.text.strip(),
                            "background_color": None,
                            "font_color": None,
                            "font_size": None,
                            "font_name": None,
                            "bold": None,
                            "italic": None,
                            "rowspan": rowspan,
                            "colspan": colspan,
                            "width_emus": cell_width_emus,
                            "width": cell_width_px
                        }

                        # Get cell background color
                        try:
                            if cell.fill and cell.fill.type == 1:  # Solid fill
                                fill_color = cell.fill.fore_color
                                if hasattr(fill_color, 'rgb') and fill_color.rgb:
                                    cell_data["background_color"] = str(fill_color.rgb)
                                elif hasattr(fill_color, 'theme_color'):
                                    cell_data["background_color"] = get_theme_colors(prs, fill_color.theme_color)
                        except Exception:
                            pass

                        # Get font properties from cell text
                        try:
                            if cell.text_frame and cell.text_frame.paragraphs:
                                for paragraph in cell.text_frame.paragraphs:
                                    for run in paragraph.runs:
                                        if run.text.strip():
                                            if run.font.color and hasattr(run.font.color, "rgb"):
                                                cell_data["font_color"] = str(run.font.color.rgb)
                                            elif run.font.color and hasattr(run.font.color, "theme_color"):
                                                cell_data["font_color"] = get_theme_colors(prs, run.font.color.theme_color)
                                            if run.font.size:
                                                cell_data["font_size"] = emu_to_px_font(run.font.size)
                                            if run.font.name:
                                                cell_data["font_name"] = run.font.name
                                            cell_data["bold"] = run.font.bold
                                            cell_data["italic"] = run.font.italic
                                            break
                                    if cell_data["font_color"]:
                                        break
                        except Exception:
                            pass

                        # Mark covered cells as visited
                        for rr in range(r, min(r + rowspan, row_count)):
                            for cc in range(c, min(c + colspan, col_count)):
                                if rr == r and cc == c:
                                    continue
                                visited[rr][cc] = True

                        row_data.append(cell_data)
                    table_data.append(row_data)

                object_data["type"] = "Table"
                object_data["table"] = table_data

            # Extract placeholder data (if the shape is a group or special shape)
            elif shape.shape_type == MSO_SHAPE_TYPE.GROUP or type(shape).__name__ == "Shape" or type(shape).__name__ == "GraphicFrame":
                # If the picture-fill probe earlier already extracted a real
                # image for this shape (the trainer-photo-on-an-ellipse case),
                # don't overwrite it with a dangling Spire/LibreOffice export
                # path — neither is installed in our container, so we'd just
                # break the working extraction.
                if should_export_as_image(shape) and not object_data.get("image"):
                    shapepath = generate_random_string(16) + ".png"
                    output_png_path = media_folder + "/" + shapepath

                    # Try Spire.Presentation first (better quality, no LibreOffice needed)
                    newshapepath = None
                    if SPIRE_AVAILABLE:
                        newshapepath = export_shape_with_spire(file_path, slide_idx, shape_idx, output_png_path)

                    # Fall back to LibreOffice if Spire failed
                    if not newshapepath:
                        newshapepath = export_grouped_shape_to_png(shape, output_png_path, media_folder)

                    if newshapepath:
                        object_data["image"] = os.path.basename(newshapepath)
                        object_data["type"] = 'Picture'
                    else:
                        object_data["image"] = shapepath
                        object_data["type"] = "Picture"
            # if shape.is_placeholder:
            #     if shape.has_text_frame:
            #         if shape.has_text_frame:
            #             extract_paragraph_info(object_data, shape.text_frame.paragraphs)
            # Save images, videos, and audio
            if shape.shape_type == MSO_SHAPE_TYPE.PICTURE or type(shape).__name__ == "PlaceholderPicture":  # Shape type for pictures
                shape_xml = etree.fromstring(shape.element.xml)
                isaudio = shape_xml.find(".//a:audioFile", namespaces={"a": "http://schemas.openxmlformats.org/drawingml/2006/main"})
                if isaudio is not None:
                    media_rId = isaudio.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}link")
                    if media_rId:
                        # Find the relationship by ID
                        rel = shape.part.rels.get(media_rId)
                        if rel and "media/" in rel.target_ref:
                            media_part = rel.target_part
                            media_data = media_part.blob

                            # Determine file extension
                            file_ext = os.path.splitext(rel.target_ref)[-1] or ".bin"
                            filename = f"{generate_random_string(16)}{file_ext}"

                            # Save the media file
                            save_media_file(media_data, media_folder, filename)
                            object_data["type"] = "Audio"
                            object_data["audio"] = filename
                elif hasattr(shape, 'image') and shape.image:
                    image = shape.image
                    # Prefer an <asvg:svgBlip> sibling when present — modern
                    # PPTs store vector icons as a raster blip + an SVG
                    # sibling (the raster is just a Backstage preview /
                    # legacy fallback). Browsers can render SVG natively and
                    # at any zoom, so always prefer it when offered.
                    saved = _extract_svg_sibling(shape, media_folder)
                    if saved is None:
                        # Sniff the blob's magic bytes — python-pptx
                        # sometimes mislabels EMF as WMF based on the
                        # part's content-type, and getting the extension
                        # wrong breaks Inkscape (which routes by extension).
                        sniffed = _sniff_image_ext(image.blob)
                        ext = (sniffed
                               or (getattr(image, 'ext', None) or 'png').lower().lstrip('.'))
                        if ext in ('wmf', 'emf'):
                            # Rasterise via LibreOffice headless — its EMF
                            # parser is the only open-source one that
                            # renders this deck's branded shapes faithfully
                            # (Inkscape drops records and collapses a
                            # 20-ray sunburst to a solid octagon). Falls
                            # back to saving the raw metafile (broken icon
                            # in browsers) when LibreOffice isn't installed
                            # or conversion fails.
                            saved = _rasterize_metafile_to_png(image.blob, ext, media_folder)
                            if saved is None:
                                saved = f"{generate_random_string(16)}.{ext}"
                                save_media_file(image.blob, media_folder, saved)
                                print(
                                    f"[Parser] picture {shape.name!r} on slide {slide_idx + 1} "
                                    f"is a {ext.upper()} metafile and LibreOffice couldn't "
                                    f"rasterise it — browsers can't render the source. "
                                    f"Install libreoffice in the api container or re-save "
                                    f"the shape as PNG/SVG in PowerPoint.",
                                    file=sys.stderr,
                                )
                        else:
                            saved = f"{generate_random_string(16)}.{ext}"
                            save_media_file(image.blob, media_folder, saved)
                    object_data["image"] = saved
                    object_data["type"] = 'Picture'
                    # Add crop data for pictures
                    crop_data = get_crop_data(shape,slide_data['properties']['width'],slide_data['properties']['height'])
                    if crop_data:
                        object_data["crop"] = crop_data
                else:
                    object_data["image"] = "No Image"
                    object_data["type"] = "none"
                

            elif shape.shape_type == MSO_SHAPE_TYPE.MEDIA:  # Check if the shape is a media object
                try:
                    # Parse the XML to find the correct relationship ID
                    shape_xml = etree.fromstring(shape.element.xml)
                    blip = shape_xml.find(".//a:videoFile", namespaces={"a": "http://schemas.openxmlformats.org/drawingml/2006/main"})
                    if blip is not None:
                        media_rId = blip.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}link")
                        if media_rId:
                            # Find the relationship by ID
                            rel = shape.part.rels.get(media_rId)
                            if rel and "media/" in rel.target_ref:
                                media_part = rel.target_part
                                media_data = media_part.blob

                                # Determine file extension
                                file_ext = os.path.splitext(rel.target_ref)[-1] or ".bin"
                                filename = f"{generate_random_string(16)}{file_ext}"

                                # Save the media file
                                save_media_file(media_data, media_folder, filename)
                                object_data["type"] = 'Video'
                                object_data["video"] = filename


                except Exception as e:
                    print()
                    #print(f"Error processing shape on Slide {slide_idx + 1}, Shape {shape_idx + 1}: {e}")


            # ── SVG fallback for custGeom + unmapped prstGeom ────────────
            # Two cases:
            #   (a) shape has <a:custGeom> — Google Slides exports star-
            #       bursts / badges / banners as custom paths rather than
            #       presets. Without this they'd fall back to a rectangle
            #       and lose their visual identity.
            #   (b) shape has <a:prstGeom prst="..."> where `prst` isn't in
            #       our shape catalog — same problem, different cause.
            # Skip both when the shape carries text — baking text into
            # the SVG would lose editability.
            #
            # NOTE: The Spire/LibreOffice "export as image" branch above
            # sets type='Picture' for custGeom shapes too — but when
            # neither is installed (production container) the PNG file
            # never lands on disk and the converter falls back to a
            # rectangle. SVG is always reproducible (pure XML math) so
            # let custGeom SVG override that dead PNG reference: vector
            # round-trip beats a broken raster reference every time.
            try:
                preset_name = object_data.get('preset_geometry')
                has_text_runs = any(
                    (p.get('text') or '').strip()
                    for p in (object_data.get('paragraph') or [])
                )
                pos = object_data.get('position')
                NS_A_LOCAL = 'http://schemas.openxmlformats.org/drawingml/2006/main'
                cust_geom = None
                try:
                    cust_geom = shape.element.find(f'.//{{{NS_A_LOCAL}}}custGeom')
                except Exception:
                    cust_geom = None

                # custGeom SVG wins over the Spire/LibreOffice raster
                # export of decorative shapes, BUT must never touch a
                # picture-fill shape (custGeom + <a:blipFill>) — those
                # carry a real bitmap from the source deck that the
                # picture-fill extractor already attached upstream.
                # Overwriting that with an empty geometric SVG would
                # blank the slide's background photo.
                existing_fill = object_data.get('fill') or {}
                is_picture_fill = (
                    existing_fill.get('type') == 'picture'
                    and isinstance(object_data.get('image'), str)
                    and object_data.get('image') != 'No Image'
                )
                already_real_picture = (
                    object_data.get('type') in ('Audio', 'Video', 'Chart', 'Table')
                    or is_picture_fill
                    or (
                        object_data.get('type') == 'Picture'
                        and cust_geom is None
                    )
                )
                needs_svg = (
                    not has_text_runs
                    and not already_real_picture
                    and media_folder
                    and pos
                    and (
                        cust_geom is not None
                        or (preset_name and preset_name not in KNOWN_CATALOG_PRESETS)
                    )
                )
                if needs_svg:
                    ln = object_data.get('line') or {}
                    fill = object_data.get('fill') or {}
                    fill_hex = fill.get('color') if fill.get('type') == 'solid' else None
                    ln_color = ln.get('color')
                    if isinstance(ln_color, str) and ln_color == 'No Line':
                        ln_color = None
                    ln_width_emu = ln.get('width')
                    sw_px = (
                        (ln_width_emu / 914400.0) * 96.0 if ln_width_emu else 0
                    )
                    if cust_geom is not None:
                        svg_text = _render_custgeom_as_svg(
                            cust_geom, NS_A_LOCAL,
                            pos['width'], pos['height'],
                            fill_hex, ln_color, sw_px, ln.get('dash'),
                        )
                    else:
                        svg_text = _render_shape_as_svg(
                            preset_name,
                            pos['width'], pos['height'],
                            fill_hex, ln_color, sw_px, ln.get('dash'),
                        )
                    if svg_text:
                        svg_filename = f"shape-{uuid.uuid4().hex[:12]}.svg"
                        save_media_file(
                            svg_text.encode('utf-8'), media_folder, svg_filename,
                        )
                        object_data['image'] = svg_filename
                        object_data['type'] = 'Picture'
                        object_data['fill'] = {'type': 'picture'}
                        # SVG bakes the stroke into pixels — clear `line`
                        # so the converter doesn't paint a CSS border too.
                        object_data['line'] = {'color': 'No Line', 'width': None}
            except Exception as ex:
                print(f"[Parser] SVG fallback failed: {ex}", file=sys.stderr)

            slide_data["objects"].append(object_data)

        # Slide-level animation timeline. Emitted AFTER objects so the
        # converter has the spid → element map available when it processes
        # this list. Empty list when the slide has no <p:timing> tree.
        try:
            slide_data['animations'] = _extract_slide_animations(slide)
        except Exception as ex:
            print(f"[Parser] animation extraction failed: {ex}", file=sys.stderr)
            slide_data['animations'] = []

        presentation_data.append(slide_data)

    return presentation_data

def should_export_as_image(shape):
    """Check if a shape should be exported as image based on its properties."""
    try:
        # Don't export as image if it has text content
        if shape.has_text_frame and shape.text.strip():
            return False
        # Don't rasterize picture shapes again; they are already exported via their image blob
        # This prevents duplicate exports (raw image + rendered PNG) for the same picture.
        if shape.shape_type == MSO_SHAPE_TYPE.PICTURE or type(shape).__name__ == 'PlaceholderPicture':
            return False
            
        # List of conditions when a shape should be exported as image
        conditions = [
            shape.shape_type == MSO_SHAPE_TYPE.GROUP,  # Group shapes
            shape.shape_type == MSO_SHAPE_TYPE.AUTO_SHAPE and shape.auto_shape_type != 1,  # Non-rectangular auto shapes
            hasattr(shape, 'custom_geometry') and shape.custom_geometry,  # Custom geometry shapes
            hasattr(shape, 'adjustments') and bool(shape.adjustments),  # Shapes with adjustments
            shape.shape_type not in [MSO_SHAPE_TYPE.TEXT_BOX, MSO_SHAPE_TYPE.PLACEHOLDER, 19]  # Not a text box, placeholder or table
        ]
        return any(conditions)
    except (AttributeError, ValueError, KeyError):
        # KeyError covers python-pptx raising on unknown `prst` values
        # (e.g. `prst="line"`) when resolving `shape.auto_shape_type`.
        # If shape has text, don't export as image
        try:
            return not (shape.has_text_frame and shape.text.strip())
        except:
            return True

# Check if enough arguments are passed
if len(sys.argv) < 4:
    print("Usage: python parser.py <file_path> <media_folder> <selected_slides> [--count|--stream]")
    sys.exit(1)
# Specify the file path and the folder to save media files
file_path = sys.argv[1]
media_folder = sys.argv[2]
selected_slides_str = sys.argv[3]

# Check for special modes
count_mode = len(sys.argv) > 4 and sys.argv[4] == '--count'
streaming_mode = len(sys.argv) > 4 and sys.argv[4] == '--stream'

# Count mode: just return the slide count and theme
if count_mode:
    prs = Presentation(file_path)
    theme_data = extract_full_theme(prs)
    count_data = {
        "total_slides": len(prs.slides),
        "theme": theme_data,
        "spire_available": SPIRE_AVAILABLE
    }
    print(json.dumps(count_data))
    sys.exit(0)

# Parse selected slides string (e.g., "1,4,5,23,65") into a list of integers
try:
    if selected_slides_str.strip():
        selected_slides = [int(x.strip()) for x in selected_slides_str.split(',') if x.strip()]
    else:
        selected_slides = []
except ValueError:
    print("Error: selected_slides must be a comma-separated list of slide numbers (e.g., '1,4,5,23,65')")
    sys.exit(1)

# Load presentation to extract theme
prs_for_theme = Presentation(file_path)
theme_data = extract_full_theme(prs_for_theme)

# Extract slides
presentation_objects = extract_objects_from_ppt(file_path, media_folder, selected_slides)

# Output the data
output_data = {
    "theme": theme_data,
    "slides": presentation_objects,
    "spire_available": SPIRE_AVAILABLE
}
print(json.dumps(output_data))