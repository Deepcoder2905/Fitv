import React, { useState, useRef, useEffect } from 'react';
import API_BASE_URL from '../config';
import { Camera, Play, Pause, Square, RotateCcw, Activity, Trophy, Target, Clock, Loader } from 'lucide-react';

const PushUpCounter = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isActive, setIsActive] = useState(false);
    const [pushUpCount, setPushUpCount] = useState(0);
    const [isInPushUp, setIsInPushUp] = useState(false);
    const [sessionTime, setSessionTime] = useState(0);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [stats, setStats] = useState({
        total_pushups: 0,
        sessions_completed: 0,
        best_session: 0,
        average_per_session: 0
    });
    const [poseDetector, setPoseDetector] = useState(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [lastPushUpTime, setLastPushUpTime] = useState(0);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStep, setLoadingStep] = useState('');
    const [currentAngle, setCurrentAngle] = useState(null);
    const [detectionQuality, setDetectionQuality] = useState('good');
    const [pushUpProgress, setPushUpProgress] = useState('none'); // 'none', 'down', 'up'
    const [poseDetectionCount, setPoseDetectionCount] = useState(0);
    const [forceUpdate, setForceUpdate] = useState(0);

    const intervalRef = useRef(null);
    const animationRef = useRef(null);
    const pushUpCountRef = useRef(0);
    const pushUpProgressRef = useRef('none');

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
                            resolve();
                        };
                    })
                ]);

                document.head.appendChild(tfScript);
                document.head.appendChild(poseScript);
                document.head.appendChild(poseNetScript);

                await scriptsLoaded;

                setLoadingStep('Initializing TensorFlow.js...');
                setLoadingProgress(70);

                await window.tf.ready();

                try {
                    await window.tf.setBackend('webgl');
                } catch (backendError) {
                    console.warn('WebGL backend failed, trying CPU...', backendError);
                    await window.tf.setBackend('cpu');
                }

                setLoadingStep('Initializing pose detector...');
                setLoadingProgress(80);

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

    // Fetch stats (dummy for now)
    const fetchStats = async () => {
        try {
            const accessToken = localStorage.getItem('access_token');
            if (!accessToken) {
                console.error('No access token found');
                return;
            }
            const response = await fetch(`${API_BASE_URL}/api/pushup-stats`, {
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
            }
        } catch (error) {
            console.error('Error fetching pushup stats:', error);
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
            let errorMessage = 'Could not access camera. ';
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Please grant camera permissions and try again.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No camera found. Please connect a camera and try again.';
            } else if (error.name === 'NotReadableError') {
                errorMessage += 'Camera is already in use by another application.';
            } else if (retryCount < 2) {
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

    // Calculate elbow angle for push-up detection
    const calculateAngle = (point1, point2, point3) => {
        const radians = Math.atan2(point3.y - point2.y, point3.x - point2.x) -
            Math.atan2(point1.y - point2.y, point1.x - point2.x);
        let angle = Math.abs(radians * 180.0 / Math.PI);
        if (angle > 180.0) angle = 360 - angle;
        return angle;
    };

    // Push-up detection logic
    const detectPushUp = (poses) => {
        setPoseDetectionCount(prev => prev + 1);
        if (!poses || poses.length === 0) return;
        const pose = poses[0];
        const keypoints = pose.keypoints;
        const getKeypoint = (name) => {
            let kp = keypoints.find(kp => kp.name === name);
            if (kp) return kp;
            kp = keypoints.find(kp => kp.part === name);
            if (kp) return kp;
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

        // Get key body parts
        const leftShoulder = getKeypoint('left_shoulder');
        const rightShoulder = getKeypoint('right_shoulder');
        const leftElbow = getKeypoint('left_elbow');
        const rightElbow = getKeypoint('right_elbow');
        const leftWrist = getKeypoint('left_wrist');
        const rightWrist = getKeypoint('right_wrist');

        // Check if all required points are detected with good confidence
        const requiredPoints = [leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist];
        const allPointsDetected = requiredPoints.every(point => point && point.score > 0.2);
        if (!allPointsDetected) return;

        const getPosition = (keypoint) => {
            if (keypoint.position) {
                return keypoint.position;
            }
            return keypoint;
        };

        // Calculate elbow angles
        const leftElbowAngle = calculateAngle(
            getPosition(leftShoulder),
            getPosition(leftElbow),
            getPosition(leftWrist)
        );
        const rightElbowAngle = calculateAngle(
            getPosition(rightShoulder),
            getPosition(rightElbow),
            getPosition(rightWrist)
        );
        const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;
        setCurrentAngle(avgElbowAngle);

        // Push-up detection thresholds
        const downThreshold = 90; // Angle below this = down
        const upThreshold = 160; // Angle above this = up
        const minTimeBetweenPushUps = 700; // ms
        const currentTime = Date.now();
        const timeSinceLastPushUp = currentTime - lastPushUpTime;

        // Additional validation
        if (avgElbowAngle < 40 || avgElbowAngle > 180) {
            setDetectionQuality('poor');
            return;
        }
        setDetectionQuality('good');

        if (avgElbowAngle < downThreshold) {
            // In down position
            if (pushUpProgressRef.current !== 'down') {
                setIsInPushUp(true);
                pushUpProgressRef.current = 'down';
            }
        } else if (avgElbowAngle > upThreshold) {
            // In up position
            if (pushUpProgressRef.current === 'down' && timeSinceLastPushUp > minTimeBetweenPushUps) {
                setIsInPushUp(false);
                pushUpProgressRef.current = 'up';
                pushUpCountRef.current += 1;
                const newCount = pushUpCountRef.current;
                setPushUpCount(newCount);
                setLastPushUpTime(currentTime);
            } else if (pushUpProgressRef.current !== 'up') {
                pushUpProgressRef.current = 'up';
            }
        }
    };

    // Draw pose and overlay
    const drawPose = (poses) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!poses || poses.length === 0) return;
        const pose = poses[0];
        const keypoints = pose.keypoints;
        const getKeypoint = (name) => {
            let kp = keypoints.find(kp => kp.name === name);
            if (kp) return kp;
            kp = keypoints.find(kp => kp.part === name);
            if (kp) return kp;
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
                return keypoint.position;
            }
            return keypoint;
        };
        // Draw skeleton (same as squat.js)
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
        ctx.strokeStyle = pushUpProgressRef.current === 'down' ? '#ef4444' : pushUpProgressRef.current === 'up' ? '#22c55e' : '#9ca3af';
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
        keypoints.forEach(keypoint => {
            if (keypoint.score > 0.2) {
                const pos = getPosition(keypoint);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
                ctx.fillStyle = pushUpProgressRef.current === 'down' ? '#ef4444' : pushUpProgressRef.current === 'up' ? '#22c55e' : '#9ca3af';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
        ctx.font = '16px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Elbow Angle: ${currentAngle ? currentAngle.toFixed(1) : 'N/A'}°`, 20, 40);
        ctx.fillStyle = detectionQuality === 'good' ? '#22c55e' : '#ef4444';
        ctx.fillText(`Quality: ${detectionQuality}`, 20, 60);
        ctx.fillStyle = pushUpProgressRef.current === 'down' ? '#ef4444' : pushUpProgressRef.current === 'up' ? '#22c55e' : '#9ca3af';
        ctx.fillText(`Status: ${pushUpProgressRef.current.toUpperCase()}`, 20, 80);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Count: ${pushUpCountRef.current}`, 20, 100);
        ctx.fillText(`Poses: ${poseDetectionCount}`, 20, 120);
        const timeSinceLast = Date.now() - lastPushUpTime;
        ctx.fillText(`Last: ${(timeSinceLast / 1000).toFixed(1)}s ago`, 20, 140);
        // Draw detection zones for visual feedback
        if (currentAngle !== null && currentAngle > 0 && currentAngle <= 180) {
            ctx.font = '14px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`Down: <90° | Up: >160°`, 20, 160);
            const barWidth = 100;
            const barHeight = 8;
            const barX = 20;
            const barY = 170;
            ctx.fillStyle = '#333333';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(barX, barY, (90 / 180) * barWidth, barHeight);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(barX + (160 / 180) * barWidth, barY, (20 / 180) * barWidth, barHeight);
            const indicatorX = barX + (currentAngle / 180) * barWidth;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(indicatorX - 2, barY - 2, 4, barHeight + 4);
        }
    };

    // Pose detection loop
    const detectPose = async () => {
        if (!poseDetector || !videoRef.current || !isActive) return;
        try {
            let poses;
            if (poseDetector.estimatePoses) {
                poses = await poseDetector.estimatePoses(videoRef.current, { flipHorizontal: false });
            } else if (poseDetector.estimateSinglePose) {
                const pose = await poseDetector.estimateSinglePose(videoRef.current, { flipHorizontal: false, decodingMethod: 'single-person' });
                poses = [pose];
            } else {
                return;
            }
            if (poses && poses.length > 0) {
                detectPushUp(poses);
                drawPose(poses);
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
        setPushUpCount(0);
        setSessionTime(0);
        setIsInPushUp(false);
        setLastPushUpTime(0);
        pushUpProgressRef.current = 'none';
        pushUpCountRef.current = 0;
        if (!isActive) {
            startCamera();
        }
    };

    const endSession = async () => {
        setIsSessionActive(false);
        if (pushUpCount > 0) {
            try {
                const accessToken = localStorage.getItem('access_token');
                if (!accessToken) {
                    console.error('No access token found');
                    return;
                }
                const response = await fetch(`${API_BASE_URL}/api/pushup-session`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        pushup_count: pushUpCount,
                        duration: sessionTime
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    fetchStats(); // Refresh stats after saving session
                } else if (response.status === 401) {
                    console.error('Unauthorized - token may be expired');
                }
            } catch (error) {
                console.error('Error saving pushup session:', error);
            }
        }
    };

    const resetSession = () => {
        setPushUpCount(0);
        setSessionTime(0);
        setIsInPushUp(false);
        setIsSessionActive(false);
        setLastPushUpTime(0);
        pushUpProgressRef.current = 'none';
        pushUpCountRef.current = 0;
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        // Debugging
        // console.log(`Push up count: ${pushUpCount}`);
    }, [pushUpCount]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                        AI Push Up Counter
                    </h1>
                    <p className="text-blue-200 text-lg">
                        Get into push-up position and start!
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
                                                <div className="text-3xl font-bold text-white">{pushUpCountRef.current}</div>
                                                <div className="text-sm text-gray-300">Push Ups</div>
                                            </div>
                                            <div className="bg-black/50 rounded-lg p-3">
                                                <div className="text-xl font-bold text-white">{formatTime(sessionTime)}</div>
                                                <div className="text-sm text-gray-300">Time</div>
                                            </div>
                                        </div>
                                        {/* Status Indicator */}
                                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                                            <div className={`px-4 py-2 rounded-full font-bold text-white ${pushUpProgressRef.current === 'down' ? 'bg-red-500' : pushUpProgressRef.current === 'up' ? 'bg-green-500' : 'bg-gray-500'}`}>
                                                {pushUpProgressRef.current === 'down' ? '🔥 DOWN' : pushUpProgressRef.current === 'up' ? '✅ UP' : '⏳ READY'}
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
                                    <div className="text-3xl font-bold text-blue-400">{pushUpCount}</div>
                                    <div className="text-sm text-gray-300">Current Push Ups</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xl font-bold text-green-400">{formatTime(sessionTime)}</div>
                                    <div className="text-sm text-gray-300">Session Time</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-purple-400">
                                        {sessionTime > 0 ? Math.round((pushUpCount / sessionTime) * 60) : 0}
                                    </div>
                                    <div className="text-sm text-gray-300">Push Ups/min</div>
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
                                    <span className="text-gray-300">Total Push Ups</span>
                                    <span className="font-bold text-white">{stats.total_pushups}</span>
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
                                <p>• Get into a push-up position with your body straight</p>
                                <p>• Lower your body until your elbows are at about 90 degrees</p>
                                <p>• Push back up to complete one rep</p>
                                <p>• The AI will automatically count your push-ups!</p>
                                <p className="text-yellow-300 mt-3">💡 Tip: Keep your elbows close to your body</p>
                                <p className="text-yellow-300">💡 Tip: Make sure your arms are clearly visible</p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/20">
                                <button
                                    onClick={resetSession}
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
};

export default PushUpCounter; 
