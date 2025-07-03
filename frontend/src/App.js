import React, { useState, useEffect } from 'react';
import './App.css';
import SquatCounter from './components/squat';
import PushUpCounter from './components/pushup';
import LoginComponent from './components/login';
import SignUpComponent from './components/signup';
import Home from './components/home';
import NavBar from './components/NavBar';
import Article from './components/article';
import Dashboard from './components/dashboard';
import Leaderboard from './components/leaderboard';

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('login');
  const [loading, setLoading] = useState(true);

  // Debug: Log state changes
  React.useEffect(() => {
  }, [user]);
  React.useEffect(() => {
  }, [currentPage]);

  // Check for existing authentication on app load
  useEffect(() => {
    const checkAuth = () => {
      const accessToken = localStorage.getItem('access_token');
      const userData = localStorage.getItem('user');

      if (accessToken && userData) {
        try {
          const user = JSON.parse(userData);
          setUser(user);
          setCurrentPage('home'); // Go to home after login/signup
        } catch (error) {
          console.error('Error parsing user data:', error);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
        }
      } else {
        setCurrentPage('login');
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogout = () => {
    console.log('handleLogout called');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentPage('login');
  };

  // NavBar handlers
  const handleNavHome = () => {
    setCurrentPage('home');
  };
  const handleNavArticles = () => {
    setCurrentPage('articles');
  };
  const handleNavDashboard = () => {
    setCurrentPage('dashboard');
  };
  const handleNavLeaderboard = () => {
    setCurrentPage('leaderboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  const showNavBar = user && !['login', 'signup'].includes(currentPage);

  return (
    <div className="App">
      {showNavBar && (
        <NavBar
          onHome={handleNavHome}
          onArticles={handleNavArticles}
          onDashboard={handleNavDashboard}
          onLeaderboard={handleNavLeaderboard}
          onLogout={handleLogout}
          currentPage={currentPage}
        />
      )}
      {currentPage === 'login' && (
        <LoginComponent setUser={setUser} setCurrentPage={setCurrentPage} />
      )}
      {currentPage === 'signup' && (
        <SignUpComponent setUser={setUser} setCurrentPage={setCurrentPage} />
      )}
      {currentPage === 'home' && user && (
        <Home
          onStartSquat={() => setCurrentPage('squat')}
          onStartPushUp={() => setCurrentPage('pushup')}
        />
      )}
      {currentPage === 'squat' && user && (
        <SquatCounter />
      )}
      {currentPage === 'pushup' && user && (
        <PushUpCounter />
      )}
      {currentPage === 'articles' && user && (
        <Article />
      )}
      {currentPage === 'dashboard' && user && (
        <Dashboard />
      )}
      {currentPage === 'leaderboard' && user && (
        <Leaderboard />
      )}
    </div>
  );
}

export default App;

