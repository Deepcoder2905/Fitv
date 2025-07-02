import React from 'react';

const NavBar = ({ onHome, onArticles, onDashboard, onLeaderboard, onLogout, currentPage }) => {
    return (
        <nav className="w-full bg-gradient-to-r from-blue-900 via-purple-900 to-indigo-900 bg-opacity-80 shadow-lg sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <span className="text-2xl font-extrabold text-white tracking-widest select-none">FitV</span>
                </div>
                <div className="flex items-center space-x-2 md:space-x-6">
                    <button
                        onClick={onHome}
                        className={`text-white font-semibold px-4 py-2 rounded-lg hover:bg-white/10 transition-colors ${currentPage === 'home' ? 'bg-white/20' : ''}`}
                    >
                        Home
                    </button>
                    <button
                        onClick={onArticles}
                        className={`text-white font-semibold px-4 py-2 rounded-lg hover:bg-white/10 transition-colors ${currentPage === 'articles' ? 'bg-white/20' : ''}`}
                    >
                        AI Article
                    </button>
                    <button
                        onClick={onDashboard}
                        className={`text-white font-semibold px-4 py-2 rounded-lg hover:bg-white/10 transition-colors ${currentPage === 'dashboard' ? 'bg-white/20' : ''}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={onLeaderboard}
                        className={`text-white font-semibold px-4 py-2 rounded-lg hover:bg-white/10 transition-colors ${currentPage === 'leaderboard' ? 'bg-white/20' : ''}`}
                    >
                        🏆 Leaderboard
                    </button>
                    <button
                        onClick={onLogout}
                        className="ml-4 bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default NavBar; 