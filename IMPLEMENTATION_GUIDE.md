## 🔧 Implementation Guide: Adding AI to Your Components

This guide shows **exact code** you need to add to your existing components.

---

## Step 1: Update `SHGUploadSection.jsx`

### Add Import at the Top

```javascript
// Add these imports
import { analyzeImageWithAI } from './utils/aiModels';
import { QualityIndicator, IssuesDisplay } from './utils/aiIntegrationExamples';
```

### Update State (in the component function)

Add after existing state declarations:

```javascript
const [aiAnalysis, setAiAnalysis] = useState({});
const [showQualityDetails, setShowQualityDetails] = useState(false);
```

### Replace `handleFileSelect` Function

Find your current `handleFileSelect` function and replace the image analysis part with:

```javascript
const handleFileSelect = async (shgId, shgName, event, analysisResults = null) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Check if already uploaded
  if (uploadedFiles[shgId]) {
    alert(t?.('upload.alreadyUploaded') || 'File already uploaded for this SHG');
    event.target.value = '';
    return;
  }

  if (uploadStatus[shgId]?.uploaded) {
    alert(t?.('upload.alreadyUploaded') || 'This SHG file is already uploaded and locked.');
    event.target.value = '';
    return;
  }

  // Validate file type
  const allowedExtensions = ['png', 'jpg', 'jpeg', 'pdf', 'tiff', 'tif', 'bmp', 'webp'];
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (!ext || !allowedExtensions.includes(ext)) {
    alert(t?.('upload.invalidFileType') || 'Invalid file type. Please upload images or PDF files only.');
    event.target.value = '';
    return;
  }

  if (file.size > 16 * 1024 * 1024) {
    alert(t?.('upload.fileTooLarge') || 'File size exceeds 16MB limit.');
    event.target.value = '';
    return;
  }

  // ============ NEW: AI ANALYSIS ============
  if (['png', 'jpg', 'jpeg', 'bmp', 'webp'].includes(ext)) {
    setAnalyzingMap(prev => ({ ...prev, [shgId]: true }));

    try {
      let analysis = analysisResults;
      if (!analysis) {
        // Perform AI analysis
        analysis = await analyzeImageWithAI(file);
      }

      // Store analysis for later display
      setAiAnalysis(prev => ({
        ...prev,
        [shgId]: analysis
      }));

      // Check if analysis passed
      if (!analysis.isValid) {
        const issuesText = analysis.issues.join('\n- ');
        const proceed = window.confirm(
          `⚠️ AI Quality Check found issues:\n\n- ${issuesText}\n\n` +
          `Suggestions:\n- ${analysis.suggestions.join('\n- ')}\n\n` +
          `Do you want to continue?`
        );

        if (!proceed) {
          event.target.value = '';
          setAnalyzingMap(prev => ({ ...prev, [shgId]: false }));
          return;
        }
      }

      // Use AI-suggested rotation
      let initialRotation = analysis.recommendedRotation ?? 0;

      // Image processing (existing code)
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          // Store file with AI analysis
          const newFile = {
            file: file,
            fileName: file.name,
            fileSize: file.size,
            uploadDate: new Date().toISOString(),
            shgName: shgName,
            shgId: shgId,
            validated: false,
            rotation: initialRotation,
            width: img.width,
            height: img.height,
            previewUrl: e.target.result,
            analysis: analysis, // Store AI analysis
            qualityScore: analysis.overall.quality
          };

          setUploadedFiles(prev => ({
            ...prev,
            [shgId]: newFile
          }));

          setAnalyzingMap(prev => ({ ...prev, [shgId]: false }));

          if (fileInputRefs.current[shgId]) {
            fileInputRefs.current[shgId].value = '';
          }

          setShowUploadModal(false);
          setPendingUploadShgId(null);
          setPendingUploadShgName(null);
        };
        img.src = e.target.result;
      };

      reader.readAsDataURL(file);

    } catch (err) {
      console.error("AI Analysis failed:", err);
      setAnalyzingMap(prev => ({ ...prev, [shgId]: false }));
      // Continue without analysis on error
    }
  } else {
    // For PDFs and other files, just store them
    const newFile = {
      file: file,
      fileName: file.name,
      fileSize: file.size,
      uploadDate: new Date().toISOString(),
      shgName: shgName,
      shgId: shgId,
      validated: false,
      rotation: 0,
      previewUrl: null
    };

    setUploadedFiles(prev => ({
      ...prev,
      [shgId]: newFile
    }));

    if (fileInputRefs.current[shgId]) {
      fileInputRefs.current[shgId].value = '';
    }

    setShowUploadModal(false);
    setPendingUploadShgId(null);
    setPendingUploadShgName(null);
  }
};
```

### Update `renderSHGCard` Function

Find where you render file info and add quality display:

```javascript
// After the file info section, add:
{fileData.analysis && (
  <div className="my-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
    <QualityIndicator analysis={fileData.analysis} size="sm" />
  </div>
)}

{fileData.analysis?.issues?.length > 0 && (
  <div className="my-3">
    <IssuesDisplay analysis={fileData.analysis} />
  </div>
)}
```

---

## Step 2: Update `smartcamera.jsx`

### Add Imports at the Top

```javascript
import { analyzeImageWithAI, getRealtimeQualityFeedback } from './utils/aiModels';
import { CameraQualityMonitor, SmartFocusGuide } from './utils/smartCameraAI';
```

### Add State in Component

```javascript
const [cameraFeedback, setCameraFeedback] = useState(null);
const [focusGuide] = useState(new SmartFocusGuide());
```

### Initialize Camera Quality Monitor

Replace your camera initialization with:

```javascript
useEffect(() => {
  if (!open) return;

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);

        // ============ NEW: Start quality monitoring ============
        const monitor = new CameraQualityMonitor(videoRef.current, canvasRef.current);
        monitor.startMonitoring((feedback) => {
          setCameraFeedback(feedback);
        });

        // Cleanup on unmount
        return () => monitor.stopMonitoring();
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Camera access is required for document scanning.");
    }
  };

  initCamera();

  return () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      setIsCameraActive(false);
    }
  };
}, [open]);
```

### Update Camera Capture Handler

```javascript
const handleCameraCapture = async () => {
  if (!videoRef.current || !canvasRef.current) return;

  setIsCapturing(true);
  const canvas = canvasRef.current;
  const context = canvas.getContext("2d");

  canvas.width = videoRef.current.videoWidth;
  canvas.height = videoRef.current.videoHeight;

  context.drawImage(videoRef.current, 0, 0);

  canvas.toBlob(async (blob) => {
    const file = new File([blob], "camera-capture.jpg", {
      type: "image/jpeg",
      lastModified: new Date().getTime()
    });

    // ============ NEW: AI Analysis ============
    try {
      const analysis = await analyzeImageWithAI(file);
      
      // Show analysis result
      setValidationResult({
        success: analysis.isValid,
        quality: analysis.overall.quality,
        issues: analysis.issues,
        analysis: analysis
      });

      setCapturedImageData(canvas.toDataURL());
      setShowValidationModal(true);
      setRotation(analysis.recommendedRotation ?? 0);

    } catch (err) {
      console.error('AI Analysis failed:', err);
      // Fallback: show image anyway
      setValidationResult({ success: true });
      setCapturedImageData(canvas.toDataURL());
      setShowValidationModal(true);
    } finally {
      setIsCapturing(false);
    }
  }, "image/jpeg", 0.95);
};
```

### Add Camera Feedback UI

In your JSX, add this to show real-time feedback:

```jsx
{cameraFeedback && isCameraActive && (
  <div className="absolute bottom-20 left-4 right-4 bg-black bg-opacity-70 text-white rounded-lg p-3 text-sm">
    <div className="flex items-center justify-between mb-2">
      <span>🎯 Focus: {cameraFeedback.focus}</span>
      <span className={cameraFeedback.focus.includes('✅') ? 'text-green-400' : 'text-yellow-400'}>
        {cameraFeedback.focus}
      </span>
    </div>
    <div className="flex items-center justify-between mb-2">
      <span>☀️ Light: {cameraFeedback.brightness}</span>
      <span className={cameraFeedback.brightness.includes('✅') ? 'text-green-400' : 'text-yellow-400'}>
        {cameraFeedback.brightness}
      </span>
    </div>
    <div className="flex items-center justify-between">
      <span>📍 Position: {cameraFeedback.positioning}</span>
      <span className="text-green-400">{cameraFeedback.positioning}</span>
    </div>
    {cameraFeedback.ready && (
      <div className="mt-3 text-center font-bold text-green-400 animate-pulse">
        ✅ Ready to capture!
      </div>
    )}
  </div>
)}
```

---

## Step 3: Create Analysis Report Display Component

Create a new file: `src/components/QualityReportModal.jsx`

```javascript
import React from 'react';
import { X, AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react';

export const QualityReportModal = ({ analysis, onClose }) => {
  if (!analysis) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-bold text-lg">AI Quality Report</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Quality Score */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-lg">
            <div className="font-semibold mb-2">Overall Quality</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${analysis.overall.quality * 100}%` }}
                />
              </div>
              <span className="font-bold">{(analysis.overall.quality * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Metrics */}
          <div className="space-y-2">
            <div className="font-semibold">Detailed Metrics:</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-600">Brightness</div>
                <div className="font-semibold">{(analysis.quality.brightness.score * 100).toFixed(0)}%</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-600">Contrast</div>
                <div className="font-semibold">{(analysis.quality.contrast.score * 100).toFixed(0)}%</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-600">Sharpness</div>
                <div className="font-semibold">{(analysis.quality.sharpness.score * 100).toFixed(0)}%</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-600">Blur Detection</div>
                <div className="font-semibold">{analysis.quality.blur.isBlurry ? '❌ Blurry' : '✅ Clear'}</div>
              </div>
            </div>
          </div>

          {/* Issues */}
          {analysis.issues.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-700 mb-1">Issues Found:</div>
                  <ul className="text-sm text-red-600 space-y-1">
                    {analysis.issues.map((issue, idx) => (
                      <li key={idx}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
              <div className="flex items-start gap-2">
                <Lightbulb size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-blue-700 mb-1">Suggestions:</div>
                  <ul className="text-sm text-blue-600 space-y-1">
                    {analysis.suggestions.map((suggestion, idx) => (
                      <li key={idx}>✓ {suggestion}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Document Detection */}
          {analysis.documentBounds && (
            <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                <div>
                  <div className="font-semibold text-green-700">Document Status</div>
                  <div className="text-sm text-green-600">
                    {analysis.documentBounds.detected ? '✅ Detected' : '❌ Not detected'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orientation */}
          {analysis.orientation && (
            <div className="bg-purple-50 p-3 rounded text-sm">
              <div className="font-semibold text-purple-700 mb-1">Orientation</div>
              <div className="text-purple-600">
                Suggested rotation: <strong>{analysis.orientation.suggestedRotation}°</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QualityReportModal;
```

---

## Step 4: Test Your Integration

### Test 1: Simple Upload Test
```javascript
// In browser console
const file = document.querySelector('input[type="file"]').files[0];
const analysis = await analyzeImageWithAI(file);
console.log(analysis);
```

### Test 2: Check Quality Score
```javascript
console.log('Quality:', analysis.overall.quality); // Should be 0-1
console.log('Issues:', analysis.issues);
console.log('Valid:', analysis.isValid);
```

### Test 3: Verify Real-time Feedback
- Open camera
- Move it around
- Check console for feedback messages
- Should see quality updates

---

## Step 5: Customize Thresholds

Edit `src/utils/aiModels.js` to adjust quality requirements:

```javascript
// Line 170 area - Adjust these thresholds
const BRIGHTNESS_MIN = 100;   // Min brightness (0-255)
const BRIGHTNESS_MAX = 200;   // Max brightness
const CONTRAST_MIN = 0.3;     // Min contrast score (0-1)
const SHARPNESS_MIN = 0.5;    // Min sharpness score (0-1)
const BLUR_THRESHOLD = 0.6;   // Blur detection threshold
```

---

## ✅ Verification Checklist

- [ ] Files created: `aiModels.js`, `smartCameraAI.js`
- [ ] Imports added to `SHGUploadSection.jsx`
- [ ] Imports added to `smartcamera.jsx`
- [ ] State variables added
- [ ] `handleFileSelect` updated with AI analysis
- [ ] Camera feedback UI added
- [ ] Tested with sample images
- [ ] Quality scores displaying correctly
- [ ] Issues showing to users
- [ ] Thresholds adjusted for your use case

---

**You're all set!** Your OCR frontend now has professional-grade AI-powered image quality detection. 🎉
