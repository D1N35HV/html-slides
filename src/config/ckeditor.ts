// CKEditor 5 global configuration
export const ckEditorConfig = {
  licenseKey: 'GPL', // GPL license for open source projects
  
  // Common toolbar configuration
  getToolbarConfig: (type: 'minimal' | 'full' = 'full') => {
    if (type === 'minimal') {
      return {
        items: ['bold', 'italic', 'link']
      };
    }
    
    return {
      items: [
        'bold', 'italic', 'underline', 'strikethrough', '|',
        'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor', '|',
        'alignment', '|',
        'bulletedList', 'numberedList', 'outdent', 'indent', '|',
        'link', 'blockQuote', '|',
        'subscript', 'superscript', '|',
        'removeFormat', 'undo', 'redo'
      ]
    };
  },
  
  // Font size options
  fontSize: {
    options: [
      8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72
    ]
  },
  
  // Font family options
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
      'Verdana, Geneva, sans-serif'
    ]
  },
  
  // Alignment options
  alignment: {
    options: ['left', 'center', 'right', 'justify']
  },
  
  // Balloon toolbar for text selection
  balloonToolbar: [
    'bold', 'italic', 'underline', 'strikethrough', '|',
    'fontSize', 'fontColor', 'fontBackgroundColor', '|',
    'alignment', '|',
    'link', 'removeFormat'
  ]
};
