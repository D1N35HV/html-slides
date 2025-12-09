import os
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

# Conversion function: EMU to Pixels
def emu_to_px_font(emu):
    return int(emu * 96 / 914400 * 1.2)

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
        
        # If no specific color found, return a default
        return theme_colors.get('dk1', '000000')
        
    except Exception as e:
        return '000000'  # Default to black if extraction fails


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
            if fill.fore_color.type == RGBColor:
                background_info["type"] = "solid"
                background_info["color"] = str(fill.fore_color.rgb)
            elif hasattr(fill.fore_color, "theme_color"):
                theme_color = fill.fore_color.theme_color
                background_info["color"] = get_theme_colors(prs , theme_color)

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

    # Fallback to layout background if no background found
    if background_info["type"] is None and slide.slide_layout.name != None:
        background_info["type"] = "image"
        create_ppt_with_layouts(slide.slide_layout, media_folder)
        filename = f"layout_{str(slide.slide_layout.name).replace(' ', '_')}.png"
        background_info["image"] = filename

    return background_info

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


def save_media_file(media, folder_path, filename):
    """Save image, audio, or video to the specified folder."""
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
    with open(os.path.join(folder_path, filename), 'wb') as file:
        file.write(media)

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
        # paragraph.alignment is numbered then convert it to string
        alignment = paragraph.alignment
        if paragraph.alignment is not None:
            try:
                if paragraph.alignment is None:
                    alignment = 'left'
                elif isinstance(paragraph.alignment, int):
                    # Try to get the name directly from the enum value
                    from pptx.enum.text import PP_PARAGRAPH_ALIGNMENT
                    alignment = str(PP_PARAGRAPH_ALIGNMENT(paragraph.alignment).name).lower()
                else:
                    alignment = str(paragraph.alignment.name).lower()
            except (ValueError, AttributeError, TypeError):
                # If conversion fails, set a default alignment
                alignment = 'left'
                
        paragraph_data = {
                "text": paragraph.text, 
                "runs": [],
                "level": paragraph.level,
                "bullet": True if bullet_char is not None else False, 
                "bullet_char": bullet_char if bullet_char is not None else False,
                "alignment": alignment,
        }
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
                    # For title placeholders, extract the default size from master slide if runs don't specify size
                    
                    default_font_size = None
                    if ph_type in ['title', 'ctrTitle'] and any(run.font.size is None for run in paragraph.runs):
                        # Get default title font size from slide layout
                        try:
                            # Find matching placeholder in slide layout
                            for layout_placeholder in slide.slide_layout.placeholders:
                                if layout_placeholder.placeholder_format.type in [1, 2]:  # Title or centered title
                                    # Check if placeholder type matches title types (could be integer or string representation)
                                    if layout_placeholder.placeholder_format.type in [1, 2] or (
                                        isinstance(layout_placeholder.placeholder_format.type, str) and 
                                        any(title_type in layout_placeholder.placeholder_format.type.upper() for title_type in ["TITLE", "CTRTITLE"])
                                    ):
                                        
                                        # Map numeric types to names for better debugging
                                        if isinstance(layout_placeholder.placeholder_format.type, int):
                                            type_names = {1: "TITLE", 2: "CENTER_TITLE"}
                                            type_name = type_names.get(layout_placeholder.placeholder_format.type, "Unknown")
                                        else:
                                            type_name = layout_placeholder.placeholder_format.type

                                        # Try to get the default font size from layout placeholder
                                        
                                        # First check if the layout placeholder has text
                                        if hasattr(layout_placeholder, 'text_frame') and layout_placeholder.text_frame.text:
                                            for layout_para in layout_placeholder.text_frame.paragraphs:
                                                for layout_run in layout_para.runs:
                                                    if layout_run.font.size:
                                                        default_font_size = layout_run.font.size
                                                        break
                                                if default_font_size:
                                                    break
                                        
                                        # If no size found in text, try to get from default properties
                                        if not default_font_size:
                                            # Try to get default text properties from slide master
                                            try:
                                                master = slide.slide_layout.slide_master
                                                if master.slide_layouts[0].shapes.title:
                                                    title_placeholder = master.slide_layouts[0].shapes.title
                                                    if title_placeholder.text_frame.paragraphs[0].runs:
                                                        default_font_size = title_placeholder.text_frame.paragraphs[0].runs[0].font.size
                                            except Exception as master_error:
                                                pass
                                        
                                if not default_font_size:
                                    # Use common PowerPoint defaults based on placeholder type
                                    if ph_type == 'ctrTitle':  # Centered title
                                        default_font_size = Pt(26)  # Slightly larger for centered titles
                                    else:  # Regular title
                                        default_font_size = Pt(25)  # ~40,000 EMUs
                                
                                # Apply the font size to runs without a size
                                for run in paragraph.runs:
                                    if run.font.size is None:
                                        run.font.size = default_font_size
                        except Exception as e:
                            # If there's an error, just log it and continue
                            pass
        except Exception as e:
            # If there's an error parsing XML, set paragraph_type to None
            paragraph_type = None

        paragraph_data["placeholder_type"] = paragraph_type

        paragraph_data["color"] = paragraph_color if paragraph_color else "000000"
        
        for run in paragraph.runs:
            font_data = {
            "text": run.text,
            "font_name": run.font.name,
            "font_size": emu_to_px_font(run.font.size) if run.font.size else None,
            "bold": run.font.bold,
            "italic": run.font.italic,
            "underline": run.font.underline,
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
            if run.font.color and hasattr(run.font.color, "rgb"):
                font_data["color"] = str(run.font.color.rgb)
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

        for shape_idx, shape in enumerate(slide.shapes):
            # Skip hidden shapes
            if is_shape_hidden(shape):
                continue
                
            object_data = {
                "name": shape.name if hasattr(shape, "name") else "Unnamed",
                "type": type(shape).__name__,
                "typenum": shape.shape_type,
                "position_emus": {
                    "left": getattr(shape, "left", None),
                    "top": getattr(shape, "top", None),
                    "width": getattr(shape, "width", None),
                    "height": getattr(shape, "height", None),
                },
                "rotation": getattr(shape, "rotation", 0),  # Convert from 60000ths of a degree to degrees
                "text": [],
                "paragraph": [],
                "fill": None,
                "line": None
            }

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

            # Extract text and font styling
            if shape.has_text_frame:
                extract_paragraph_info(prs,object_data, shape.text_frame.paragraphs,shape,slide)


            # Handle shapes with a fill attribute
            if hasattr(shape, 'fill'):
                if shape.fill and shape.fill.type == 1:  # Solid fill
                    fill_color = shape.fill.fore_color
                    try:
                        object_data["fill"] = {
                            "type": "solid",
                            "color": str(fill_color.rgb) if fill_color.rgb else "No Fill"
                        }
                    except Exception as e:
                        if isinstance(fill_color, RGBColor):
                            object_data["fill"] = {
                                "type": "solid",
                                "color": str(fill_color.rgb) if fill_color.rgb else "No Fill"
                            }
                        elif hasattr(fill_color, "theme_color"):
                            object_data["fill"] = {
                                "type": "solid",
                                "color": str(fill_color.theme_color)  # For SchemeColor
                            }
                        else:
                            object_data["fill"] = {"type": "none"}
                elif shape.fill and shape.fill.type == 2:  # Gradient fill
                    # Extract gradient details for CSS-compatible output
                    gradient_data = {"type": "gradient", "stops": [], "angle": 0}
                    try:
                        # Get gradient angle
                        gradient_data["angle"] = getattr(shape.fill, 'gradient_angle', 0) or 0
                        
                        # Get gradient stops
                        if hasattr(shape.fill, 'gradient_stops'):
                            for stop in shape.fill.gradient_stops:
                                try:
                                    stop_color = str(stop.color.rgb) if stop.color.rgb else "000000"
                                    stop_position = int(stop.position * 100) if stop.position else 0
                                    gradient_data["stops"].append({
                                        "color": stop_color,
                                        "position": stop_position
                                    })
                                except:
                                    pass
                    except Exception as grad_error:
                        pass
                    object_data["fill"] = gradient_data
                else:
                    object_data["fill"] = {"type": "none"}
            else:
                object_data["fill"] = {"type": "none"}  # No fill for shapes that don't have a fill attribute

            # Extract line information
            if hasattr(shape, "line"):
                line_color = None
                if shape.line.color and not isinstance(shape.line.color, type(None)):  # Ensure it's not None
                    try:
                        # Handle RGBColor and SchemeColor for line color
                        if isinstance(shape.line.color, RGBColor):
                            line_color = str(shape.line.color.rgb)
                        elif hasattr(shape.line.color, "theme_color"):
                            line_color = str(shape.line.color.theme_color)
                        else:
                            line_color = "No Line"
                    except AttributeError:
                        line_color = "No Line"
                object_data["line"] = {
                    "color": line_color or "No Line",
                    "width": shape.line.width if shape.line.width else None
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
                if should_export_as_image(shape):
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
                    filename = f"{generate_random_string(16)}.png"
                    save_media_file(image.blob, media_folder, filename)
                    object_data["image"] = filename
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


            slide_data["objects"].append(object_data)

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
    except (AttributeError, ValueError):
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