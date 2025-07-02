import React from 'react';
import squatImg from '../assets/image1.png'; // Squat image
import pushupImg from '../assets/image.png'; // Push up image (replace with your own or use fallback)

const Home = ({ onStartSquat, onStartPushUp }) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Squat Card */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-xl flex flex-col items-center">
                    <img
                        src={squatImg}
                        alt="Squat"
                        className="w-40 h-40 object-contain mb-6 drop-shadow-lg rounded-xl bg-black/10"
                        onError={e => { e.target.src = 'https://cdn-icons-png.flaticon.com/512/1048/1048953.png'; }}
                    />
                    <h2 className="text-3xl font-bold text-white mb-2 text-center">AI Squat Counter</h2>
                    <p className="text-blue-200 text-center mb-6">Track your squats with AI!<br />Click below to start your session.</p>
                    <button
                        onClick={onStartSquat}
                        className="bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-all duration-200"
                    >
                        Start Squat Session
                    </button>
                </div>
                {/* Push Up Card */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-xl flex flex-col items-center">
                    <img
                        src={pushupImg}
                        alt="Push Up"
                        className="w-40 h-40 object-contain mb-6 drop-shadow-lg rounded-xl bg-black/10"
                        onError={e => { e.target.src = 'https://cdn-icons-png.flaticon.com/512/1048/1048953.png'; }}
                    />
                    <h2 className="text-3xl font-bold text-white mb-2 text-center">AI Push Up Counter</h2>
                    <p className="text-blue-200 text-center mb-6">Track your push ups with AI!<br />Click below to start your session.</p>
                    <button
                        onClick={onStartPushUp}
                        className="bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:from-pink-600 hover:to-yellow-600 text-white px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-all duration-200"
                    >
                        Start Push Up Session
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Home; 