# AI Document Scanner - Usage Examples

## Basic Usage Example

### Capturing a Document with Camera

```javascript
import SmartCamera from './smartcamera';
import { useState } from 'react';

function MyUploadComponent() {
  const [showCamera, setShowCamera] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const handleCameraCapture = (processedFile) => {
    // processedFile is already validated and enhanced
    console.log('Received processed file:', processedFile.name);
    setUploadedFile(processedFile);
    setShowCamera(false);
    
    // Ready to upload to server
    uploadToServer(processedFile);
  };

  return (
    <div>
      <button onClick={() => setShowCamera(true)}>
        📸 Scan Document
      </button>

      <SmartCamera
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />

      {uploadedFile && (
        <div>✅ File ready: {uploadedFile.name}</div>
      )}
    </div>
  );
}
```

## Advanced Usage Examples

### Manual Document Scanning

```javascript
import { scanDocument, canvasToFile } from './utils/documentScanner';

async function scanAndProcessDocument(imageFile) {
  try {
    // Step 1: Scan the document
    const result = await scanDocument(imageFile);

    // Step 2: Check validation
    if (!result.isValid) {
      // Show user-friendly error messages
      console.error('Validation failed:');
      result.issues.forEach((issue, idx) => {
        console.error(`${idx + 1}. ${issue}`);
      });
      return null;
    }

    // Step 3: Get enhanced image
    const enhancedFile = await canvasToFile(
      result.enhancedCanvas,
      'document-scanned.jpg'
    );

    // Step 4: View validation details
    console.log('Validation Summary:');
    console.log(`✓ Passed: ${result.summary.passedChecks}/5 checks`);
    console.log(`✓ Blur Score: ${result.validations.blur.blurScore.toFixed(2)}`);
    console.log(`✓ Brightness: ${result.validations.lighting.avgBrightness.toFixed(0)}`);
    console.log(`✓ Table Structure: ${result.validations.table.horizontalLines}H x ${result.validations.table.verticalLines}V`);

    return enhancedFile;
  } catch (error) {
    console.error('Scanning error:', error.message);
    return null;
  }
}
```

### Batch Processing Multiple Documents

```javascript
async function batchScanDocuments(imageFiles) {
  const results = {
    successful: [],
    failed: []
  };

  for (const file of imageFiles) {
    try {
      const result = await scanDocument(file);
      
      if (result.isValid) {
        const enhancedFile = await canvasToFile(result.enhancedCanvas, file.name);
        results.successful.push({
          originalName: file.name,
          processedFile: enhancedFile,
          validation: result
        });
      } else {
        results.failed.push({
          fileName: file.name,
          issues: result.issues
        });
      }
    } catch (error) {
      results.failed.push({
        fileName: file.name,
        error: error.message
      });
    }
  }

  return results;
}

// Usage
const files = [image1.jpg, image2.jpg, image3.jpg];
const results = await batchScanDocuments(files);

console.log(`✅ Successful: ${results.successful.length}`);
console.log(`❌ Failed: ${results.failed.length}`);

// Handle failed documents
results.failed.forEach(failed => {
  console.log(`${failed.fileName}:`);
  failed.issues.forEach(issue => console.log(`  - ${issue}`));
});
```

### Custom Validation UI Component

```javascript
import { scanDocument } from './utils/documentScanner';
import { CheckCircle, AlertTriangle } from 'lucide-react';

function ValidationResultsDisplay({ validationResult }) {
  const { isValid, validations, issues } = validationResult;

  return (
    <div className={`p-6 rounded-lg border-2 ${isValid ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {isValid ? (
          <>
            <CheckCircle className="text-green-600" size={24} />
            <h3 className="text-xl font-bold text-green-800">Document Valid ✓</h3>
          </>
        ) : (
          <>
            <AlertTriangle className="text-red-600" size={24} />
            <h3 className="text-xl font-bold text-red-800">Validation Failed</h3>
          </>
        )}
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="mb-4 space-y-2">
          <h4 className="font-semibold text-sm">Issues Found:</h4>
          {issues.map((issue, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <span className="text-yellow-600 font-bold">⚠</span>
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Validation Metrics */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-600">Blur Score</p>
          <p className="font-bold text-lg">
            {validations.blur.isBlurry ? '❌ Blurry' : '✓ Sharp'}
          </p>
          <p className="text-gray-500 text-xs">
            {validations.blur.blurScore.toFixed(0)} / {validations.blur.threshold}
          </p>
        </div>

        <div>
          <p className="text-gray-600">Brightness</p>
          <p className="font-bold text-lg">
            {validations.lighting.avgBrightness.toFixed(0)}/255
          </p>
          <p className="text-gray-500 text-xs">
            {validations.lighting.quality === 'good' ? '✓ Good' : '⚠ ' + validations.lighting.quality}
          </p>
        </div>

        <div>
          <p className="text-gray-600">Document Edges</p>
          <p className="font-bold text-lg">
            {validations.edges.detected ? '✓ Found' : '❌ Missing'}
          </p>
          <p className="text-gray-500 text-xs">
            {validations.edges.edgePixels} edge pixels
          </p>
        </div>

        <div>
          <p className="text-gray-600">Table Structure</p>
          <p className="font-bold text-lg">
            {validations.table.detected ? '✓ Found' : '❌ Missing'}
          </p>
          <p className="text-gray-500 text-xs">
            {validations.table.horizontalLines}H × {validations.table.verticalLines}V
          </p>
        </div>

        <div>
          <p className="text-gray-600">Text Detection</p>
          <p className="font-bold text-lg">
            {validations.text.textPresent ? '✓ Found' : '❌ Missing'}
          </p>
          <p className="text-gray-500 text-xs">
            {(validations.text.textDensity * 100).toFixed(1)}% density
          </p>
        </div>

        <div>
          <p className="text-gray-600">Overall Status</p>
          <p className="font-bold text-lg">
            {validations.summary.passedChecks}/5 ✓
          </p>
        </div>
      </div>
    </div>
  );
}
```

### Error Handling with Retry Logic

```javascript
async function captureWithRetry(maxRetries = 3) {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      attempts++;
      console.log(`Attempt ${attempts}/${maxRetries}`);
      
      // Show camera UI
      const file = await openCameraAndCapture();
      
      // Validate
      const result = await scanDocument(file);
      
      if (result.isValid) {
        console.log('✅ Document valid!');
        return result;
      } else {
        console.log('⚠️ Issues found:');
        result.issues.forEach(issue => console.log(`  - ${issue}`));
        
        // Retry if not exceeded
        if (attempts < maxRetries) {
          const retry = await askUserToRetry(
            `Issue: ${result.issues[0]}`
          );
          if (!retry) break;
        }
      }
    } catch (error) {
      console.error(`Attempt ${attempts} failed:`, error.message);
      
      if (attempts >= maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts`);
      }
    }
  }
  
  throw new Error('Could not capture valid document');
}
```

### Integration with Upload Form

```javascript
import { useState } from 'react';
import SmartCamera from './smartcamera';
import { scanDocument, canvasToFile } from './utils/documentScanner';

function DocumentUploadForm() {
  const [showCamera, setShowCamera] = useState(false);
  const [documentFile, setDocumentFile] = useState(null);
  const [validationInfo, setValidationInfo] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Scan the file
    const result = await scanDocument(file);
    setValidationInfo(result);

    if (result.isValid) {
      // Convert enhanced canvas to file
      const enhancedFile = await canvasToFile(result.enhancedCanvas);
      setDocumentFile(enhancedFile);
    }
  };

  const handleCameraCapture = (processedFile) => {
    setDocumentFile(processedFile);
    setShowCamera(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!documentFile) {
      alert('Please capture or upload a document first');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', documentFile);
      formData.append('shgId', document.getElementById('shgId').value);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        alert('✅ Document uploaded successfully!');
        // Reset form
        setDocumentFile(null);
        setValidationInfo(null);
      } else {
        alert('❌ Upload failed');
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* SHG Selection */}
      <div>
        <label>SHG ID:</label>
        <input id="shgId" type="text" required />
      </div>

      {/* Document Upload */}
      <div>
        <label>Upload Document:</label>
        <div className="space-y-2">
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            📸 Use Camera
          </button>
        </div>
      </div>

      {/* Validation Results */}
      {validationInfo && (
        <div className={`p-4 rounded border-2 ${validationInfo.isValid ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
          {validationInfo.isValid ? (
            <p className="text-green-800">✅ Document is valid and ready to upload</p>
          ) : (
            <div>
              <p className="text-red-800 font-bold">❌ Issues found:</p>
              <ul className="text-red-700 mt-2">
                {validationInfo.issues.map((issue, idx) => (
                  <li key={idx}>• {issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!documentFile || uploading}
        className="bg-green-600 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : 'Upload Document'}
      </button>

      {/* Camera Modal */}
      <SmartCamera
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />
    </form>
  );
}

export default DocumentUploadForm;
```

### Debugging and Development

```javascript
// Enable detailed validation logging
async function debugScanDocument(file) {
  console.group('📊 Document Scanning Debug');
  
  const result = await scanDocument(file);
  
  console.log('Overall Status:', result.isValid ? '✅ PASS' : '❌ FAIL');
  console.log('');
  
  // Blur Detection
  console.group('Blur Detection');
  console.log('Result:', result.validations.blur.isBlurry ? 'BLURRY' : 'SHARP');
  console.log('Score:', result.validations.blur.blurScore);
  console.log('Threshold:', result.validations.blur.threshold);
  console.log('Status:', result.validations.blur.isBlurry ? '❌' : '✅');
  console.groupEnd();
  
  // Lighting Analysis
  console.group('Lighting Analysis');
  console.log('Quality:', result.validations.lighting.quality);
  console.log('Brightness:', result.validations.lighting.avgBrightness);
  console.log('Dynamic Range:', result.validations.lighting.dynamicRange);
  console.log('Shadow Diff:', result.validations.lighting.shadowDifference);
  console.log('Issues:', result.validations.lighting.issues);
  console.groupEnd();
  
  // Document Detection
  console.group('Document Edge Detection');
  console.log('Detected:', result.validations.edges.detected ? '✅' : '❌');
  console.log('Edge Pixels:', result.validations.edges.edgePixels);
  console.log('Bounds:', result.validations.edges.bounds);
  console.log('Dimensions:', result.validations.edges.dimensions);
  console.groupEnd();
  
  // Table Detection
  console.group('Table Structure Detection');
  console.log('Detected:', result.validations.table.detected ? '✅' : '❌');
  console.log('Horizontal Lines:', result.validations.table.horizontalLines);
  console.log('Vertical Lines:', result.validations.table.verticalLines);
  console.groupEnd();
  
  // Text Detection
  console.group('Text Presence Validation');
  console.log('Present:', result.validations.text.textPresent ? '✅' : '❌');
  console.log('Text Density:', (result.validations.text.textDensity * 100).toFixed(2) + '%');
  console.log('Text Pixels:', result.validations.text.textPixels);
  console.groupEnd();
  
  // Issues Summary
  if (result.issues.length > 0) {
    console.group('❌ Issues Found');
    result.issues.forEach((issue, idx) => {
      console.log(`${idx + 1}. ${issue}`);
    });
    console.groupEnd();
  }
  
  console.log('');
  console.log('Summary:', `${result.summary.passedChecks}/5 checks passed`);
  console.groupEnd();
  
  return result;
}

// Usage
const file = await selectImage();
await debugScanDocument(file);
```

## Tips & Best Practices

### 1. Always Validate Before Upload
```javascript
const result = await scanDocument(file);
if (!result.isValid) {
  showErrorsToUser(result.issues);
  return;
}
```

### 2. Use Enhanced Canvas for OCR
```javascript
// The enhanced canvas is optimized for OCR
const enhancedFile = await canvasToFile(result.enhancedCanvas);
// Use this file for Tesseract.js or similar
```

### 3. Provide User Guidance
```javascript
// Show specific guidance based on failure reason
if (result.issues.includes("Image is blurry")) {
  showGuidance("Keep your phone steady while capturing");
} else if (result.issues.includes("too dark")) {
  showGuidance("Move to a well-lit area or use flash");
}
```

### 4. Handle Async Operations
```javascript
// Always use try-catch for scanning
try {
  const result = await scanDocument(file);
} catch (error) {
  // Handle errors gracefully
  console.error('Scanning failed:', error);
}
```

### 5. Optimize for Mobile
```javascript
// Reduce canvas size for slower devices
const maxDim = 800;  // Instead of 1200

// Show progress indicator
while (scanning) {
  <Loader className="animate-spin" />
}
```

---

**Last Updated:** January 2026  
**Status:** Ready for Production ✅
