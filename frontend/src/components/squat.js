import React, { useState, useRef, useEffect } from 'react';
import API_BASE_URL from '../config';
import { Camera, Play, Pause, Square, RotateCcw, Activity, Trophy, Target, Clock, Loader } from 'lucide-react';

const SquatCounter = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isActive, setIsActive] = useState(false);
    const [squatCount, setSquatCount] = useState(0);
    const [isInSquat, setIsInSquat] = useState(false);
    const [sessionTime, setSessionTime] = useState(0);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [stats, setStats] = useState({
        total_squats: 0,
        sessions_completed: 0,
        best_session: 0,
        average_per_session: 0
    });
    const [poseDetector, setPoseDetector] = useState(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [lastSquatTime, setLastSquatTime] = useState(0);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStep, setLoadingStep] = useState('');
    const [currentAngle, setCurrentAngle] = useState(null);
    const [detectionQuality, setDetectionQuality] = useState('good');
    const [squatProgress, setSquatProgress] = useState('none'); // 'none', 'squatting', 'standing'
    const [poseDetectionCount, setPoseDetectionCount] = useState(0); // Add pose detection counter
    const [forceUpdate, setForceUpdate] = useState(0); // Add force update state

    const intervalRef = useRef(null);
    const animationRef = useRef(null);
    const squatCountRef = useRef(0); // Add ref to track squat count
    const squatProgressRef = useRef('none'); // Add ref to track squat progress state

    // Load TensorFlow.js and PoseNet model with optimizations
    useEffect(() => {
        const loadModel = async () => {
            try {
                setLoadingStep('Loading TensorFlow.js...');
                setLoadingProgress(20);

                // Add preload hints for faster loading
                const preloadTF = document.createElement('link');
                preloadTF.rel = 'preload';
                preloadTF.as = 'script';
                preloadTF.href = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js';
                document.head.appendChild(preloadTF);

                const preloadPose = document.createElement('link');
                preloadPose.rel = 'preload';
                preloadPose.as = 'script';
                preloadPose.href = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.0/dist/pose-detection.min.js';
                document.head.appendChild(preloadPose);

                // Load TensorFlow.js and PoseNet in parallel with newer versions
                const tfScript = document.createElement('script');
                tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js';

                const poseScript = document.createElement('script');
                poseScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.0/dist/pose-detection.min.js';

                // Also load older PoseNet as fallback
                const poseNetScript = document.createElement('script');
                poseNetScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/posenet@2.2.2/dist/posenet.min.js';

                // Load all scripts in parallel
                const scriptsLoaded = Promise.all([
                    new Promise((resolve, reject) => {
                        tfScript.onload = () => {
                            setLoadingStep('TensorFlow.js loaded...');
                            setLoadingProgress(40);
                            resolve();
                        };
                        tfScript.onerror = () => reject(new Error('Failed to load TensorFlow.js'));
                    }),
                    new Promise((resolve, reject) => {
                        poseScript.onload = () => {
                            setLoadingStep('Pose detection model loaded...');
                            setLoadingProgress(50);
                            resolve();
                        };
                        poseScript.onerror = () => reject(new Error('Failed to load pose detection model'));
                    }),
                    new Promise((resolve, reject) => {
                        poseNetScript.onload = () => {
                            setLoadingStep('Legacy PoseNet loaded...');
                            setLoadingProgress(60);
                            resolve();
                        };
                        poseNetScript.onerror = () => {
                            console.warn('Legacy PoseNet failed to load, continuing without fallback');
                            resolve(); // Don't fail completely if legacy model fails
                        };
                    })
                ]);

                document.head.appendChild(tfScript);
                document.head.appendChild(poseScript);
                document.head.appendChild(poseNetScript);

                await scriptsLoaded;

                setLoadingStep('Initializing TensorFlow.js...');
                setLoadingProgress(70);

                // Initialize TensorFlow.js properly
                await window.tf.ready();

                // Set backend explicitly to avoid WebGPU issues
                try {
                    await window.tf.setBackend('webgl');
                } catch (backendError) {
                    console.warn('WebGL backend failed, trying CPU...', backendError);
                    await window.tf.setBackend('cpu');
                }

                setLoadingStep('Initializing pose detector...');
                setLoadingProgress(80);

                // Use the newer pose detection API with fallback
                let detector;
                try {
                    detector = await window.poseDetection.createDetector(
                        window.poseDetection.SupportedModels.MoveNet,
                        {
                            modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
                            enableSmoothing: true,
                            minPoseScore: 0.3
                        }
                    );
                } catch (moveNetError) {
                    console.warn('MoveNet failed, trying BlazePose...', moveNetError);
                    setLoadingStep('Trying alternative model...');

                    try {
                        detector = await window.poseDetection.createDetector(
                            window.poseDetection.SupportedModels.BlazePose,
                            {
                                runtime: 'tfjs',
                                enableSmoothing: true,
                                modelType: 'full'
                            }
                        );
                    } catch (blazePoseError) {
                        console.warn('BlazePose failed, trying PoseNet...', blazePoseError);
                        setLoadingStep('Trying legacy model...');

                        try {
                            // Fallback to older PoseNet model
                            detector = await window.posenet.load({
                                architecture: 'MobileNetV1',
                                outputStride: 16,
                                inputResolution: { width: 640, height: 480 },
                                multiplier: 0.75
                            });
                        } catch (poseNetError) {
                            console.error('All models failed:', poseNetError);
                            throw new Error('Failed to initialize any pose detection model');
                        }
                    }
                }

                setPoseDetector(detector);
                setIsModelLoaded(true);
                setLoadingProgress(100);
                setLoadingStep('Ready!');

                // Clear loading state after a short delay
                setTimeout(() => {
                    setLoadingStep('');
                    setLoadingProgress(0);
                }, 1000);

            } catch (error) {
                console.error('Error loading pose detection model:', error);
                setCameraError('Failed to load pose detection model. Please refresh the page.');
                setLoadingStep('');
                setLoadingProgress(0);
            }
        };

        loadModel();
        fetchStats();

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    // Timer effect
    useEffect(() => {
        if (isSessionActive) {
            intervalRef.current = setInterval(() => {
                setSessionTime(prev => prev + 1);
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isSessionActive]);

    const fetchStats = async () => {
        try {
            const accessToken = localStorage.getItem('access_token');
            if (!accessToken) {
                console.error('No access token found');
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/stats`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setStats(data.stats);
            } else if (response.status === 401) {
                console.error('Unauthorized - token may be expired');
                // Could implement token refresh here
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const startCamera = async (retryCount = 0) => {
        try {
            setLoadingStep('Starting camera...');
            setLoadingProgress(10);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 30, max: 60 },
                    facingMode: 'user'
                }
            });

            setLoadingProgress(50);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;

                // Wait for video to be ready
                await new Promise((resolve) => {
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current.play();
                        setLoadingProgress(100);
                        setTimeout(() => {
                            setIsActive(true);
                            setCameraError(null);
                            setLoadingStep('');
                            setLoadingProgress(0);
                            resolve();
                        }, 500);
                    };
                });
            }
        } catch (error) {
            console.error('Error accessing camera:', error);

            // Provide specific error messages based on error type
            let errorMessage = 'Could not access camera. ';

            if (error.name === 'NotAllowedError') {
                errorMessage += 'Please grant camera permissions and try again.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No camera found. Please connect a camera and try again.';
            } else if (error.name === 'NotReadableError') {
                errorMessage += 'Camera is already in use by another application.';
            } else if (retryCount < 2) {
                // Retry with lower resolution
                setLoadingStep('Retrying with lower resolution...');
                setTimeout(() => startCamera(retryCount + 1), 1000);
                return;
            } else {
                errorMessage += 'Please ensure you have granted camera permissions and try again.';
            }

            setCameraError(errorMessage);
            setLoadingStep('');
            setLoadingProgress(0);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsActive(false);
    };

    const calculateAngle = (point1, point2, point3) => {
        const radians = Math.atan2(point3.y - point2.y, point3.x - point2.x) -
            Math.atan2(point1.y - point2.y, point1.x - point2.x);
        let angle = Math.abs(radians * 180.0 / Math.PI);
        if (angle > 180.0) angle = 360 - angle;
        return angle;
    };

    const detectSquat = (poses) => {
        // Increment pose detection counter
        setPoseDetectionCount(prev => prev + 1);

        if (!poses || poses.length === 0) return;

        const pose = poses[0];
        const keypoints = pose.keypoints;

        // Handle different keypoint formats
        const getKeypoint = (name) => {
            // Try newer model format first (name property)
            let kp = keypoints.find(kp => kp.name === name);
            if (kp) return kp;

            // Try legacy PoseNet format (part property)
            kp = keypoints.find(kp => kp.part === name);
            if (kp) return kp;

            // Try legacy PoseNet format with different naming
            const legacyNames = {
                'left_hip': 'leftHip',
                'right_hip': 'rightHip',
                'left_knee': 'leftKnee',
                'right_knee': 'rightKnee',
                'left_ankle': 'leftAnkle',
                'right_ankle': 'rightAnkle'
            };
            return keypoints.find(kp => kp.part === legacyNames[name]);
        };

        // Get key body parts
        const leftHip = getKeypoint('left_hip');
        const rightHip = getKeypoint('right_hip');
        const leftKnee = getKeypoint('left_knee');
        const rightKnee = getKeypoint('right_knee');
        const leftAnkle = getKeypoint('left_ankle');
        const rightAnkle = getKeypoint('right_ankle');

        // Check if all required points are detected with good confidence
        const requiredPoints = [leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle];
        const allPointsDetected = requiredPoints.every(point =>
            point && point.score > 0.2
        );

        if (!allPointsDetected) return;

        // Get position coordinates (handle different formats)
        const getPosition = (keypoint) => {
            if (keypoint.position) {
                return keypoint.position; // Legacy PoseNet format
            }
            return keypoint; // Newer models format
        };

        // Calculate knee angles
        const leftKneeAngle = calculateAngle(
            getPosition(leftHip),
            getPosition(leftKnee),
            getPosition(leftAnkle)
        );
        const rightKneeAngle = calculateAngle(
            getPosition(rightHip),
            getPosition(rightKnee),
            getPosition(rightAnkle)
        );

        // Average knee angle
        const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

        // Update current angle state
        setCurrentAngle(avgKneeAngle);

        // Squat detection logic with realistic thresholds
        const currentTime = Date.now();
        const timeSinceLastSquat = currentTime - lastSquatTime;

        // Realistic thresholds based on actual squat angles
        const squatThreshold = 165; // Angle below this = squatting (more lenient)
        const standThreshold = 175; // Angle above this = standing (more lenient)
        const minTimeBetweenSquats = 800; // Minimum time between squats

        // Additional validation: check if angle is reasonable
        if (avgKneeAngle < 50 || avgKneeAngle > 190) {
            setDetectionQuality('poor');
            return;
        }

        setDetectionQuality('good');

        // Simplified and more robust squat detection logic
        if (avgKneeAngle < squatThreshold) {
            // Person is in squat position
            if (squatProgressRef.current !== 'squatting') {
                setIsInSquat(true);
                squatProgressRef.current = 'squatting';
                console.log(`🔥 Squat detected! Angle: ${avgKneeAngle.toFixed(1)}°`);
            }
        } else if (avgKneeAngle > standThreshold) {
            // Person is standing
            if (squatProgressRef.current === 'squatting' && timeSinceLastSquat > minTimeBetweenSquats) {
                // Person stood up from squat - count it
                console.log(`✅ Squat completed! Angle: ${avgKneeAngle.toFixed(1)}°`);

                setIsInSquat(false);
                squatProgressRef.current = 'standing';

                // Update both ref and state for immediate counter update
                squatCountRef.current += 1;
                const newCount = squatCountRef.current;
                setSquatCount(newCount);
                setLastSquatTime(currentTime);

                console.log(`🎯 Squat counted! New count: ${newCount}`);
            } else if (squatProgressRef.current !== 'standing') {
                // Person is standing but not transitioning from squat
                squatProgressRef.current = 'standing';
            }
        }
        // If angle is between thresholds, keep current state

        // Debug logging (less frequent to avoid spam)
        if (currentTime % 1000 < 16) { // Log once per second
            console.log(`📊 Angle: ${avgKneeAngle.toFixed(1)}°, Progress: ${squatProgressRef.current}, Count: ${squatCountRef.current}`);
        }
    };

    const drawPose = (poses) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!poses || poses.length === 0) return;

        const pose = poses[0];
        const keypoints = pose.keypoints;

        // Handle different keypoint formats
        const getKeypoint = (name) => {
            // Try newer model format first (name property)
            let kp = keypoints.find(kp => kp.name === name);
            if (kp) return kp;

            // Try legacy PoseNet format (part property)
            kp = keypoints.find(kp => kp.part === name);
            if (kp) return kp;

            // Try legacy PoseNet format with different naming
            const legacyNames = {
                'left_shoulder': 'leftShoulder',
                'right_shoulder': 'rightShoulder',
                'left_elbow': 'leftElbow',
                'right_elbow': 'rightElbow',
                'left_wrist': 'leftWrist',
                'right_wrist': 'rightWrist',
                'left_hip': 'leftHip',
                'right_hip': 'rightHip',
                'left_knee': 'leftKnee',
                'right_knee': 'rightKnee',
                'left_ankle': 'leftAnkle',
                'right_ankle': 'rightAnkle'
            };
            return keypoints.find(kp => kp.part === legacyNames[name]);
        };

        const getPosition = (keypoint) => {
            if (keypoint.position) {
                return keypoint.position; // Legacy PoseNet format
            }
            return keypoint; // Newer models format
        };

        // Calculate knee angle for display
        let avgKneeAngle = null;
        const leftHip = getKeypoint('left_hip');
        const rightHip = getKeypoint('right_hip');
        const leftKnee = getKeypoint('left_knee');
        const rightKnee = getKeypoint('right_knee');
        const leftAnkle = getKeypoint('left_ankle');
        const rightAnkle = getKeypoint('right_ankle');

        if (leftHip && rightHip && leftKnee && rightKnee && leftAnkle && rightAnkle) {
            const leftKneeAngle = calculateAngle(
                getPosition(leftHip),
                getPosition(leftKnee),
                getPosition(leftAnkle)
            );
            const rightKneeAngle = calculateAngle(
                getPosition(rightHip),
                getPosition(rightKnee),
                getPosition(rightAnkle)
            );
            avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
        }

        // Draw skeleton
        const connections = [
            ['left_shoulder', 'right_shoulder'],
            ['left_shoulder', 'left_elbow'],
            ['left_elbow', 'left_wrist'],
            ['right_shoulder', 'right_elbow'],
            ['right_elbow', 'right_wrist'],
            ['left_shoulder', 'left_hip'],
            ['right_shoulder', 'right_hip'],
            ['left_hip', 'right_hip'],
            ['left_hip', 'left_knee'],
            ['left_knee', 'left_ankle'],
            ['right_hip', 'right_knee'],
            ['right_knee', 'right_ankle']
        ];

        // Draw connections
        ctx.strokeStyle = squatProgressRef.current === 'squatting' ? '#ef4444' :
            squatProgressRef.current === 'standing' ? '#22c55e' : '#9ca3af';
        ctx.lineWidth = 3;

        connections.forEach(([partA, partB]) => {
            const pointA = getKeypoint(partA);
            const pointB = getKeypoint(partB);

            if (pointA && pointB && pointA.score > 0.2 && pointB.score > 0.2) {
                const posA = getPosition(pointA);
                const posB = getPosition(pointB);

                ctx.beginPath();
                ctx.moveTo(posA.x, posA.y);
                ctx.lineTo(posB.x, posB.y);
                ctx.stroke();
            }
        });

        // Draw keypoints
        keypoints.forEach(keypoint => {
            if (keypoint.score > 0.2) {
                const pos = getPosition(keypoint);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
                ctx.fillStyle = squatProgressRef.current === 'squatting' ? '#ef4444' :
                    squatProgressRef.current === 'standing' ? '#22c55e' : '#9ca3af';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        // Draw angle and quality info (but not the squat/stand status)
        ctx.font = '16px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Angle: ${currentAngle ? currentAngle.toFixed(1) : 'N/A'}°`, 20, 40);

        // Show detection quality
        ctx.fillStyle = detectionQuality === 'good' ? '#22c55e' : '#ef4444';
        ctx.fillText(`Quality: ${detectionQuality}`, 20, 60);

        // Show squat progress
        ctx.fillStyle = squatProgressRef.current === 'squatting' ? '#ef4444' :
            squatProgressRef.current === 'standing' ? '#22c55e' : '#9ca3af';
        ctx.fillText(`Status: ${squatProgressRef.current.toUpperCase()}`, 20, 80);

        // Show counter status
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Count: ${squatCountRef.current}`, 20, 100);

        // Show pose detection count
        ctx.fillText(`Poses: ${poseDetectionCount}`, 20, 120);

        // Show time since last squat
        const timeSinceLast = Date.now() - lastSquatTime;
        ctx.fillText(`Last: ${(timeSinceLast / 1000).toFixed(1)}s ago`, 20, 140);

        // Draw detection zones for visual feedback
        if (currentAngle !== null && currentAngle > 0 && currentAngle <= 180) {
            ctx.font = '14px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`Squat: <150° | Stand: >160°`, 20, 160);

            // Draw a small indicator bar
            const barWidth = 100;
            const barHeight = 8;
            const barX = 20;
            const barY = 170;

            // Background bar
            ctx.fillStyle = '#333333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Squat zone (red)
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(barX, barY, (150 / 180) * barWidth, barHeight);

            // Stand zone (green)
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(barX + (160 / 180) * barWidth, barY, (10 / 180) * barWidth, barHeight);

            // Current position indicator
            const indicatorX = barX + (currentAngle / 180) * barWidth;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(indicatorX - 2, barY - 2, 4, barHeight + 4);
        }
    };

    const detectPose = async () => {
        if (!poseDetector || !videoRef.current || !isActive) {
            console.log(`🚫 detectPose skipped: poseDetector=${!!poseDetector}, videoRef=${!!videoRef.current}, isActive=${isActive}`);
            return;
        }

        try {
            let poses;

            // Handle different model types
            if (poseDetector.estimatePoses) {
                // Newer models (MoveNet, BlazePose)
                poses = await poseDetector.estimatePoses(videoRef.current, {
                    flipHorizontal: false
                });
            } else if (poseDetector.estimateSinglePose) {
                // Legacy PoseNet model
                const pose = await poseDetector.estimateSinglePose(videoRef.current, {
                    flipHorizontal: false,
                    decodingMethod: 'single-person'
                });
                poses = [pose];
            } else {
                console.error('Unknown pose detector type');
                return;
            }

            // Debug pose detection
            if (poses && poses.length > 0) {
                console.log(`👤 Pose detected: ${poses.length} poses found`);
                detectSquat(poses);
                drawPose(poses);
            } else {
                console.log(`❌ No poses detected`);
            }
        } catch (error) {
            console.error('Error detecting pose:', error);
        }

        animationRef.current = requestAnimationFrame(detectPose);
    };

    useEffect(() => {
        if (isActive && poseDetector) {
            detectPose();
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isActive, poseDetector]);

    const startSession = () => {
        setIsSessionActive(true);
        setSquatCount(0);
        setSessionTime(0);
        setIsInSquat(false);
        setLastSquatTime(0);
        squatProgressRef.current = 'none';
        squatCountRef.current = 0; // Reset the ref as well
        if (!isActive) {
            startCamera();
        }
    };

    const endSession = async () => {
        setIsSessionActive(false);

        if (squatCount > 0) {
            try {
                const accessToken = localStorage.getItem('access_token');
                if (!accessToken) {
                    console.error('No access token found');
                    return;
                }

                const response = await fetch(`${API_BASE_URL}/api/squat-session`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        squat_count: squatCount,
                        duration: sessionTime
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    // Refresh stats after saving session
                    fetchStats();
                } else if (response.status === 401) {
                    console.error('Unauthorized - token may be expired');
                }
            } catch (error) {
                console.error('Error saving session:', error);
            }
        }
    };

    const resetSession = () => {
        setSquatCount(0);
        setSessionTime(0);
        setIsInSquat(false);
        setIsSessionActive(false);
        setLastSquatTime(0);
        squatProgressRef.current = 'none';
        squatCountRef.current = 0; // Reset the ref as well
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Monitor squat count changes for debugging
    useEffect(() => {
        console.log(`🔄 Squat count changed to: ${squatCount}`);
    }, [squatCount]);

    // Monitor squat progress changes for debugging
    useEffect(() => {
        console.log(`🔄 Squat progress changed to: ${squatProgressRef.current}`);
    }, [squatProgressRef.current]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                        AI Squat Counter
                    </h1>
                    <p className="text-blue-200 text-lg">
                        Stand in front of your camera and start squatting!
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Camera Section */}
                    <div className="lg:col-span-2">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                            <div className="relative">
                                {cameraError ? (
                                    <div className="aspect-video bg-red-500/20 rounded-lg flex items-center justify-center border-2 border-red-500/50">
                                        <p className="text-red-200 text-center px-4">{cameraError}</p>
                                    </div>
                                ) : !isModelLoaded ? (
                                    <div className="aspect-video bg-black/20 rounded-lg flex flex-col items-center justify-center border-2 border-blue-500/50">
                                        <Loader className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                                        <p className="text-blue-200 text-center px-4 mb-2">{loadingStep}</p>
                                        {loadingProgress > 0 && (
                                            <div className="w-64 bg-gray-700 rounded-full h-2 mb-2">
                                                <div
                                                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${loadingProgress}%` }}
                                                ></div>
                                            </div>
                                        )}
                                        <p className="text-sm text-gray-400">{loadingProgress}%</p>
                                    </div>
                                ) : (
                                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                                        <video
                                            ref={videoRef}
                                            className="w-full h-full object-cover"
                                            style={{ transform: 'scaleX(-1)' }}
                                            playsInline
                                            autoPlay
                                            muted
                                        />
                                        <canvas
                                            ref={canvasRef}
                                            className="absolute top-0 left-0 w-full h-full"
                                            style={{ transform: 'scaleX(-1)' }}
                                        />

                                        {/* Overlay UI */}
                                        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                                            <div className="bg-black/50 rounded-lg p-3">
                                                <div className="text-3xl font-bold text-white">{squatCountRef.current}</div>
                                                <div className="text-sm text-gray-300">Squats</div>
                                            </div>

                                            <div className="bg-black/50 rounded-lg p-3">
                                                <div className="text-xl font-bold text-white">{formatTime(sessionTime)}</div>
                                                <div className="text-sm text-gray-300">Time</div>
                                            </div>
                                        </div>

                                        {/* Status Indicator */}
                                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                                            <div className={`px-4 py-2 rounded-full font-bold text-white ${squatProgressRef.current === 'squatting' ? 'bg-red-500' :
                                                squatProgressRef.current === 'standing' ? 'bg-green-500' : 'bg-gray-500'
                                                }`}>
                                                {squatProgressRef.current === 'squatting' ? '🔥 SQUATTING' :
                                                    squatProgressRef.current === 'standing' ? '✅ STANDING' : '⏳ READY'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Controls */}
                            <div className="flex justify-center space-x-4 mt-6">
                                {!isActive ? (
                                    <button
                                        onClick={startCamera}
                                        disabled={!isModelLoaded}
                                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                                    >
                                        {!isModelLoaded ? (
                                            <>
                                                <Loader className="w-5 h-5 animate-spin" />
                                                <span>Loading Model...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Camera className="w-5 h-5" />
                                                <span>Start Camera</span>
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopCamera}
                                        className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                                    >
                                        <Square className="w-5 h-5" />
                                        <span>Stop Camera</span>
                                    </button>
                                )}

                                {isActive && (
                                    <>
                                        {!isSessionActive ? (
                                            <button
                                                onClick={startSession}
                                                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                                            >
                                                <Play className="w-5 h-5" />
                                                <span>Start Session</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={endSession}
                                                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                                            >
                                                <Pause className="w-5 h-5" />
                                                <span>End Session</span>
                                            </button>
                                        )}

                                        <button
                                            onClick={resetSession}
                                            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                                        >
                                            <RotateCcw className="w-5 h-5" />
                                            <span>Reset</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats Section */}
                    <div className="space-y-6">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                                <Activity className="w-5 h-5 mr-2" />
                                Session Stats
                            </h2>

                            <div className="space-y-4">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-blue-400">{squatCount}</div>
                                    <div className="text-sm text-gray-300">Current Squats</div>
                                </div>

                                <div className="text-center">
                                    <div className="text-xl font-bold text-green-400">{formatTime(sessionTime)}</div>
                                    <div className="text-sm text-gray-300">Session Time</div>
                                </div>

                                <div className="text-center">
                                    <div className="text-lg font-bold text-purple-400">
                                        {sessionTime > 0 ? Math.round((squatCount / sessionTime) * 60) : 0}
                                    </div>
                                    <div className="text-sm text-gray-300">Squats/min</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                                <Trophy className="w-5 h-5 mr-2" />
                                Overall Stats
                            </h2>

                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-300">Total Squats</span>
                                    <span className="font-bold text-white">{stats.total_squats}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-300">Sessions</span>
                                    <span className="font-bold text-white">{stats.sessions_completed}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-300">Best Session</span>
                                    <span className="font-bold text-white">{stats.best_session}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-300">Average</span>
                                    <span className="font-bold text-white">{Math.round(stats.average_per_session)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                                <Target className="w-5 h-5 mr-2" />
                                Instructions
                            </h2>

                            <div className="text-sm text-gray-300 space-y-2">
                                <p>• Stand facing the camera with your full body visible</p>
                                <p>• Keep your feet shoulder-width apart</p>
                                <p>• Squat down until your knees are at about 90 degrees</p>
                                <p>• Stand back up to complete one rep</p>
                                <p>• The AI will automatically count your squats!</p>
                                <p className="text-yellow-300 mt-3">💡 Tip: Watch the angle indicator on screen</p>
                                <p className="text-yellow-300">💡 Tip: Make sure your knees are clearly visible</p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-white/20">
                                <button
                                    onClick={() => {
                                        setSquatCount(0);
                                        setSessionTime(0);
                                        setIsInSquat(false);
                                        setLastSquatTime(0);
                                        squatProgressRef.current = 'none';
                                        squatCountRef.current = 0; // Reset the ref as well
                                    }}
                                    className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors mb-2"
                                >
                                    Reset Counter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SquatCounter;
