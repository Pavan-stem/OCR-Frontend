/**
 * Example: Integrating AI Models into SHGUploadSection
 * This file shows how to use the AI models in your upload component
 */

import { analyzeImageWithAI } from './utils/aiModels';
import { CameraQualityMonitor, SmartFocusGuide, CaptureOptimizer } from './utils/smartCameraAI';

// ============================================================================
// EXAMPLE 1: Enhanced File Selection with AI Analysis
// ============================================================================

/**
 * Enhanced handleFileSelect with AI analysis
 * Drop-in replacement for existing function
 */
export const enhancedHandleFileSelect = async (
  shgId,
  shgName,
  event,
  analysisResults = null,
  onAnalysisComplete = null
) => {
  const file = event.target.files?.[0];
  if (!file) return;

  console.log(`📸 Analyzing image for SHG: ${shgName} (${shgId})`);

  // Show analyzing state in UI
  if (onAnalysisComplete) {
    onAnalysisComplete({ status: 'analyzing', shgId });
  }

  try {
    // Perform comprehensive AI analysis
    let analysis = analysisResults;
    if (!analysis) {
      analysis = await analyzeImageWithAI(file);
    }

    console.log('🤖 Analysis Result:', analysis);

    // Check if analysis passed
    if (!analysis.isValid) {
      // Show issues to user
      const issuesText = analysis.issues.join('\n- ');
      const proceed = window.confirm(
        `⚠️ AI Analysis found potential issues:\n\n- ${issuesText}\n\n` +
        `Suggestions:\n- ${analysis.suggestions.join('\n- ')}\n\n` +
        `Do you want to use this image anyway?`
      );

      if (!proceed) {
        if (onAnalysisComplete) {
          onAnalysisComplete({ status: 'rejected', shgId, reason: issuesText });
        }
        event.target.value = '';
        return;
      }
    }

    // Analysis passed - use suggested rotation
    const initialRotation = analysis.recommendedRotation ?? 0;

    // Create file object with analysis attached
    const newFile = {
      file: file,
      fileName: file.name,
      fileSize: file.size,
      uploadDate: new Date().toISOString(),
      shgName: shgName,
      shgId: shgId,
      validated: false,
      rotation: initialRotation,
      analysis: analysis, // Store AI analysis results
      qualityScore: analysis.overall.quality,
      issues: analysis.issues,
      suggestions: analysis.suggestions
    };

    if (onAnalysisComplete) {
      onAnalysisComplete({
        status: 'success',
        shgId,
        analysis,
        file: newFile
      });
    }

    return newFile;

  } catch (err) {
    console.error('AI Analysis error:', err);
    if (onAnalysisComplete) {
      onAnalysisComplete({
        status: 'error',
        shgId,
        error: err.message
      });
    }
    // Fallback: allow manual upload without AI
    return null;
  }
};

// ============================================================================
// EXAMPLE 2: Real-time Camera Quality Feedback
// ============================================================================

/**
 * Camera quality monitor hook for SmartCamera component
 */
export const useCameraQualityMonitor = (videoRef, canvasRef) => {
  const [feedback, setFeedback] = React.useState(null);
  const [monitorRef] = React.useState(() =>
    new CameraQualityMonitor(videoRef.current, canvasRef.current)
  );

  React.useEffect(() => {
    // Start monitoring when component mounts
    monitorRef.startMonitoring((feedback) => {
      setFeedback(feedback);
      console.log('📊 Camera Feedback:', feedback);
    });

    // Cleanup
    return () => monitorRef.stopMonitoring();
  }, []);

  return feedback;
};

/**
 * Example camera capture with AI quality check
 */
export const handleSmartCameraCapture = async (
  videoRef,
  canvasRef,
  onCaptureComplete
) => {
  if (!videoRef.current || !canvasRef.current) return;

  const canvas = canvasRef.current;
  const context = canvas.getContext('2d');

  // Capture frame
  canvas.width = videoRef.current.videoWidth;
  canvas.height = videoRef.current.videoHeight;
  context.drawImage(videoRef.current, 0, 0);

  // Convert to file
  const blob = await new Promise(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', 0.95);
  });

  const file = new File([blob], 'camera-capture.jpg', {
    type: 'image/jpeg',
    lastModified: new Date().getTime()
  });

  // Analyze with AI
  const analysis = await analyzeImageWithAI(file);

  console.log('📸 Captured image analysis:', analysis);

  if (onCaptureComplete) {
    onCaptureComplete({
      file,
      analysis,
      quality: analysis.overall.quality,
      isGood: analysis.isValid
    });
  }

  return { file, analysis };
};

// ============================================================================
// EXAMPLE 3: Focus Guide Integration
// ============================================================================

/**
 * Smart focus guide hook
 */
export const useFocusGuide = (canvasRef) => {
  const [focusGuide] = React.useState(new SmartFocusGuide());
  const [guidance, setGuidance] = React.useState(null);
  const [focusScore, setFocusScore] = React.useState(0);

  const updateFocus = React.useCallback((canvas) => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const score = focusGuide.calculateFocusScore(imageData);
    setFocusScore(score);

    const guide = focusGuide.getFocusGuidance(score);
    setGuidance(guide);

    return { score, guide };
  }, [focusGuide]);

  return { guidance, focusScore, updateFocus };
};

// ============================================================================
// EXAMPLE 4: Batch Quality Assessment
// ============================================================================

/**
 * Assess quality of multiple files
 * Useful for bulk uploads
 */
export const assessBatchQuality = async (files) => {
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const analysis = await analyzeImageWithAI(file);
        return {
          fileName: file.name,
          analysis,
          passed: analysis.isValid,
          quality: analysis.overall.quality
        };
      } catch (err) {
        return {
          fileName: file.name,
          error: err.message,
          passed: false,
          quality: 0
        };
      }
    })
  );

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log(`✅ Passed: ${passedCount}, ❌ Failed: ${failedCount}`);

  return {
    results,
    summary: {
      total: results.length,
      passed: passedCount,
      failed: failedCount,
      avgQuality: results.reduce((sum, r) => sum + (r.quality ?? 0), 0) / results.length
    }
  };
};

// ============================================================================
// EXAMPLE 5: Quality-based UI Rendering
// ============================================================================

/**
 * Render quality indicator based on analysis
 */
export const QualityIndicator = ({ analysis, size = 'md' }) => {
  if (!analysis) return null;

  const { overall, brightness, contrast, sharpness } = analysis;

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const getColorClass = (score) => {
    if (score > 0.7) return 'text-green-600 bg-green-50';
    if (score > 0.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreLabel = (score) => {
    if (score > 0.7) return '✅ Good';
    if (score > 0.5) return '⚠️ Fair';
    return '❌ Poor';
  };

  return (
    <div className={`rounded-lg p-3 ${getColorClass(overall.quality)}`}>
      <div className={`font-semibold mb-2 ${sizeClasses[size]}`}>
        Overall Quality: {getScoreLabel(overall.quality)} ({(overall.quality * 100).toFixed(0)}%)
      </div>

      <div className={`space-y-1 text-xs ${sizeClasses[size]}`}>
        <div className="flex justify-between">
          <span>Brightness:</span>
          <span>{(brightness.score * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Contrast:</span>
          <span>{(contrast.score * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Sharpness:</span>
          <span>{(sharpness.score * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// EXAMPLE 6: Issue Display Component
// ============================================================================

/**
 * Display analysis issues and suggestions to user
 */
export const IssuesDisplay = ({ analysis }) => {
  if (!analysis || analysis.issues.length === 0) {
    return <div className="text-green-600 font-semibold">✅ No issues detected</div>;
  }

  return (
    <div className="space-y-3">
      {analysis.issues.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
          <div className="font-semibold text-red-700 mb-2">⚠️ Issues Found:</div>
          <ul className="text-sm text-red-600 space-y-1">
            {analysis.issues.map((issue, idx) => (
              <li key={idx}>• {issue}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.suggestions.length > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
          <div className="font-semibold text-blue-700 mb-2">💡 Suggestions:</div>
          <ul className="text-sm text-blue-600 space-y-1">
            {analysis.suggestions.map((suggestion, idx) => (
              <li key={idx}>✓ {suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// EXAMPLE 7: Integration with Upload Progress
// ============================================================================

/**
 * Enhanced upload with quality-based prioritization
 */
export const prioritizeUploadsByQuality = (files) => {
  // Sort files by quality score (highest first)
  return files.sort((a, b) => {
    const scoreA = a.analysis?.overall?.quality ?? 0;
    const scoreB = b.analysis?.overall?.quality ?? 0;
    return scoreB - scoreA;
  });
};

// ============================================================================
// EXAMPLE 8: Analytics Tracking
// ============================================================================

/**
 * Track quality metrics for analytics
 */
export const trackQualityMetrics = (analysis) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    quality: {
      overall: analysis.overall.quality,
      brightness: analysis.quality.brightness.score,
      contrast: analysis.quality.contrast.score,
      sharpness: analysis.quality.sharpness.score
    },
    issues: analysis.issues.length,
    passed: analysis.isValid,
    documentDetected: analysis.documentBounds.detected,
    suggestedRotation: analysis.recommendedRotation
  };

  // Send to analytics backend if available
  console.log('📊 Quality Metrics:', metrics);

  return metrics;
};

export default {
  enhancedHandleFileSelect,
  useCameraQualityMonitor,
  handleSmartCameraCapture,
  useFocusGuide,
  assessBatchQuality,
  QualityIndicator,
  IssuesDisplay,
  prioritizeUploadsByQuality,
  trackQualityMetrics
};
