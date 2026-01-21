# AI-Powered Document Scanner System

## Overview

The AI-powered document scanner system is a professional-grade document capture and validation system integrated into the file upload application. It intelligently captures, validates, enhances, and processes document images containing tabular data with the precision of professional scanning apps like Adobe Scan or CamScanner.

## Architecture

### Components

1. **smartcamera.jsx** - Main camera interface component
   - Live video stream capture from device camera
   - Gallery/file fallback option
   - Validation results modal
   - Real-time user feedback

2. **documentScanner.js** - Core scanning and validation engine
   - 6-step validation pipeline
   - Image enhancement algorithms
   - Comprehensive error detection
   - Canvas-based image processing

3. **imageQualityCheck.js** - Legacy compatibility layer
   - Basic image analysis (kept for backward compatibility)
   - Integrated with document scanner

## Validation Pipeline

### Step 1: Blur Detection
**Algorithm:** Laplacian Variance Detection
- Computes Laplacian operator for every pixel
- Calculates variance of Laplacian responses
- Threshold: < 100 indicates blur
- **Error:** "Image is blurry. Please capture again."

### Step 2: Lighting Analysis
**Checks:**
- Average brightness (optimal: 50-200)
- Dynamic range (contrast > 50)
- Shadow distribution across quadrants

**Errors:**
- "Image is too dark. Please use flash or improve lighting and capture again."
- "Image is overexposed. Avoid glare and capture again."
- "Low contrast image. Capture in better lighting."
- "Shadow detected. Ensure even lighting and capture again."

### Step 3: Document Edge Detection
**Algorithm:** Sobel-like Edge Detection
- Detects horizontal and vertical edges
- Creates bounding box around content
- Validates all four edges are visible
- Requires minimum 30% of image for document

**Error:** "Document edges not detected. Please capture the full page."

### Step 4: Table Structure Detection
**Algorithm:** Line Detection (Horizontal & Vertical)
- Scans for horizontal lines (table rows)
- Scans for vertical lines (table columns)
- Minimum requirements:
  - ≥ 3 horizontal lines
  - ≥ 2 vertical lines

**Error:** "No table detected in the image. Please capture an image with a table."

### Step 5: Text Validation
**Algorithm:** High-Contrast Pixel Analysis
- Counts pixels that are very dark (< 100) or very light (> 200)
- Calculates text density ratio
- Minimum threshold: 5% text density

**Error:** "Text not detected. Please capture clearly with visible text."

### Step 6: Image Enhancement
**Processes:**
1. **Grayscale Conversion**
   - Uses LUMA formula: 0.299R + 0.587G + 0.114B
   - Optimal for OCR preprocessing

2. **Contrast Enhancement**
   - Normalizes pixel values to full 0-255 range
   - Improves readability

3. **Adaptive Thresholding**
   - Local mean-based thresholding
   - Preserves text clarity
   - Reduces shadow artifacts

## User Interface

### Camera Interface
- **Video Stream:** Live preview with document guide overlay
- **Scanning Tips:** Real-time guidance (good lighting, flat document, etc.)
- **Controls:**
  - Capture Button: Scan document
  - Gallery Button: Upload from device storage

### Validation Results Modal
- **Status Indicator:** Pass/Fail with visual feedback
- **Issue List:** User-friendly error messages
- **Detailed Report:** Expandable validation metrics
- **Actions:**
  - Retry: Rescan document
  - Use Document: Accept if validation passes

### Upload Method Selection
- **Two Options:**
  1. Upload File - Select from device
  2. AI Document Scanner - Capture & validate with camera
- **Features List:** Shows all AI capabilities

## Error Messages & User Feedback

All error messages are designed to be:
- **Clear:** Specific issue identified
- **Actionable:** Suggests how to fix
- **User-Friendly:** Non-technical language

### Error Categories

**Image Quality Issues:**
- Blurry images
- Dark/underexposed images
- Overexposed/washed out images
- Low contrast images

**Document Detection Issues:**
- Document not fully visible
- Edges not detected
- Partial page capture

**Content Validation Issues:**
- No table structure detected
- Text not readable
- No meaningful content found

## Technical Specifications

### Performance Optimization
- Maximum image dimension: 1200px
- Automatic downscaling for large images
- Efficient memory management with typed arrays

### Canvas Processing
- 2D canvas API for image manipulation
- Blob conversion for file generation
- JPEG output at 95% quality

### Browser Compatibility
- Requires HTML5 Canvas API
- Requires Web APIs: getUserMedia, FileReader
- Works on mobile and desktop browsers

## File Output

### Enhanced Document File
- **Format:** JPEG
- **Quality:** 95% (optimal for OCR)
- **Processing:** Grayscale, thresholded, enhanced
- **Ready for:** Upload and OCR processing

## Integration Points

### With SHGUploadSection
```javascript
// Camera capture triggers document scanning
onCapture={handleSmartCameraCapture}

// Validation results integrated into upload flow
// Enhanced image ready for upload after validation passes
```

### With File Upload
```javascript
// Both camera capture and gallery upload go through:
scanDocument(file) → validates → enhances → returns processedFile
```

## Validation Success Criteria

A document passes validation when ALL checks pass:
- ✓ Not blurry (Laplacian variance > 100)
- ✓ Proper lighting (brightness 50-200, dynamic range > 50)
- ✓ Document edges visible (> 30% of image)
- ✓ Table structure detected (≥3 h-lines, ≥2 v-lines)
- ✓ Text present (> 5% text density)

## API Reference

### scanDocument(file: File): Promise<Result>
Performs complete document validation and enhancement.

**Returns:**
```javascript
{
  isValid: boolean,
  issues: string[],
  validations: {
    blur: { isBlurry, blurScore },
    lighting: { quality, avgBrightness, dynamicRange },
    edges: { detected, bounds, dimensions },
    table: { detected, horizontalLines, verticalLines },
    text: { textPresent, textDensity }
  },
  enhancedCanvas: HTMLCanvasElement,
  originalCanvas: HTMLCanvasElement,
  summary: { totalIssues, passedChecks }
}
```

### canvasToFile(canvas: HTMLCanvasElement, filename: string): Promise<File>
Converts enhanced canvas to uploadable File object.

## Future Enhancements

1. **Perspective Correction**
   - Automatic document corner detection
   - Perspective transformation for skewed documents

2. **OCR Integration**
   - Tesseract.js for text extraction
   - Language detection
   - Text validation by content

3. **Advanced Enhancement**
   - Deskewing
   - Shadow removal
   - Color document handling

4. **Performance**
   - GPU acceleration (WebGL)
   - Web Workers for processing
   - Streaming validation

## Testing & Quality Assurance

### Test Cases
- Document at various angles
- Different lighting conditions
- Partially visible documents
- Multiple tables in frame
- Blurry vs. sharp images
- High contrast vs. low contrast

### Success Metrics
- 95%+ accurate blur detection
- 98%+ accurate document edge detection
- 90%+ accurate table detection
- < 2 second processing time

## Troubleshooting

### Camera Not Working
- Check browser permissions
- Use HTTPS (required for camera access)
- Try gallery upload as fallback

### Validation Always Fails
- Ensure good lighting
- Keep document flat and centered
- Avoid shadows and reflections
- Check image focus

### Processing Slow
- Reduce image resolution
- Close unnecessary browser tabs
- Clear browser cache

## References

- Laplacian Blur Detection: OpenCV documentation
- Adaptive Thresholding: Niblack & Sauvola algorithms
- Edge Detection: Sobel operator theory
- Image Enhancement: Contrast stretching & normalization
