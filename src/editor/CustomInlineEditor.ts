import { InlineEditor } from '@ckeditor/ckeditor5-editor-inline';
import { Essentials } from '@ckeditor/ckeditor5-essentials';
import { Paragraph } from '@ckeditor/ckeditor5-paragraph';
import { Bold, Italic, Underline, Strikethrough } from '@ckeditor/ckeditor5-basic-styles';
import { Font } from '@ckeditor/ckeditor5-font';
import { Alignment } from '@ckeditor/ckeditor5-alignment';
import { List } from '@ckeditor/ckeditor5-list';
import { Link } from '@ckeditor/ckeditor5-link';
import { Autoformat } from '@ckeditor/ckeditor5-autoformat';
import { BlockQuote } from '@ckeditor/ckeditor5-block-quote';
import { PasteFromOffice } from '@ckeditor/ckeditor5-paste-from-office';
import { TextTransformation } from '@ckeditor/ckeditor5-typing';
import { Indent } from '@ckeditor/ckeditor5-indent';

export class CustomInlineEditor extends InlineEditor {
    public static builtinPlugins = [
        Essentials,
        Paragraph,
        Bold,
        Italic,
        Underline,
        Strikethrough,
        Font,
        Alignment,
        List,
        Link,
        Autoformat,
        BlockQuote,
        PasteFromOffice,
        TextTransformation,
        Indent
    ];

    public static defaultConfig = {
        toolbar: {
            items: []
        },
        fontFamily: {
            options: [
                'default',
                'Arial, Helvetica, sans-serif',
                'Courier New, Courier, monospace',
                'Georgia, serif',
                'Lucida Sans Unicode, Lucida Grande, sans-serif',
                'Tahoma, Geneva, sans-serif',
                'Times New Roman, Times, serif',
                'Trebuchet MS, Helvetica, sans-serif',
                'Verdana, Geneva, sans-serif',
                'League Gothic, sans-serif'
            ]
        },
        fontSize: {
            options: [
                '9px', '10px', '11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px', '22px', '24px', '26px', '28px', '30px', '32px', '36px', '40px', '44px', '48px', '56px', '64px', '72px', '96px'
            ],
            supportAllValues: true
        },
        fontColor: {
            colors: [
                { color: '#000000', label: 'Black' },
                { color: '#ffffff', label: 'White' },
                { color: '#ff0000', label: 'Red' },
                { color: '#00ff00', label: 'Green' },
                { color: '#0000ff', label: 'Blue' },
                { color: '#ffff00', label: 'Yellow' },
                { color: '#00ffff', label: 'Cyan' },
                { color: '#ff00ff', label: 'Magenta' },
                { color: '#808080', label: 'Grey' },
                { color: '#800000', label: 'Maroon' }
            ]
        },
        language: 'en'
    };
}
