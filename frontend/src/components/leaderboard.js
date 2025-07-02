import React, { useEffect, useState } from 'react';

const Leaderboard = () => {
    const [mode, setMode] = useState('all'); // 'all' or 'daily'
    const [squats, setSquats] = useState([]);
    const [pushups, setPushups] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeaderboards();
    }, [mode]);

    const fetchLeaderboards = async () => {
        setLoading(true);
        try {
            const squatRes = await fetch(`/api/leaderboard/squats${mode === 'daily' ? '/daily' : ''}`);
            const pushupRes = await fetch(`/api/leaderboard/pushups${mode === 'daily' ? '/daily' : ''}`);
            const squatData = await squatRes.json();
            const pushupData = await pushupRes.json();
            setSquats(squatData.leaderboard || []);
            setPushups(pushupData.leaderboard || []);
        } catch (err) {
            setSquats([]);
            setPushups([]);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6 flex flex-col items-center">
            <div className="w-full max-w-2xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-xl mt-8">
                <h1 className="text-3xl font-bold text-white mb-6 text-center">Leaderboard</h1>
                <div className="flex justify-center mb-6">
                    <button
                        className={`px-4 py-2 rounded-l-lg font-semibold ${mode === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700'}`}
                        onClick={() => setMode('all')}
                    >
                        All Time
                    </button>
                    <button
                        className={`px-4 py-2 rounded-r-lg font-semibold ${mode === 'daily' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700'}`}
                        onClick={() => setMode('daily')}
                    >
                        Today
                    </button>
                </div>
                {loading ? (
                    <div className="text-white text-center">Loading...</div>
                ) : (
                    <>
                        <h2 className="text-xl font-bold text-white mb-2 mt-4">Top 5 Squats ({mode === 'all' ? 'All Time' : 'Today'})</h2>
                        <table className="w-full mb-6 text-white text-lg border border-white/20 rounded-lg overflow-hidden">
                            <thead>
                                <tr className="bg-blue-900/60">
                                    <th className="py-2 px-4">Rank</th>
                                    <th className="py-2 px-4">Username</th>
                                    <th className="py-2 px-4">Total Squats</th>
                                </tr>
                            </thead>
                            <tbody>
                                {squats.length === 0 ? (
                                    <tr><td colSpan={3} className="text-center py-4">No data</td></tr>
                                ) : squats.map((user, idx) => (
                                    <tr key={user.username} className="odd:bg-blue-900/20">
                                        <td className="py-2 px-4 text-center">{idx + 1}</td>
                                        <td className="py-2 px-4 text-center">{user.username}</td>
                                        <td className="py-2 px-4 text-center">{user.total_squats}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <h2 className="text-xl font-bold text-white mb-2 mt-8">Top 5 Pushups ({mode === 'all' ? 'All Time' : 'Today'})</h2>
                        <table className="w-full mb-6 text-white text-lg border border-white/20 rounded-lg overflow-hidden">
                            <thead>
                                <tr className="bg-blue-900/60">
                                    <th className="py-2 px-4">Rank</th>
                                    <th className="py-2 px-4">Username</th>
                                    <th className="py-2 px-4">Total Pushups</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pushups.length === 0 ? (
                                    <tr><td colSpan={3} className="text-center py-4">No data</td></tr>
                                ) : pushups.map((user, idx) => (
                                    <tr key={user.username} className="odd:bg-blue-900/20">
                                        <td className="py-2 px-4 text-center">{idx + 1}</td>
                                        <td className="py-2 px-4 text-center">{user.username}</td>
                                        <td className="py-2 px-4 text-center">{user.total_pushups}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </div>
        </div>
    );
};

export default Leaderboard; 