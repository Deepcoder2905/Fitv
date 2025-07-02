import React, { useEffect, useState } from 'react';

const Dashboard = () => {
    const [squatStats, setSquatStats] = useState(null);
    const [pushupStats, setPushupStats] = useState(null);
    const [user, setUser] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState({ username: '', email: '' });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        fetchStats();
        fetchPushupStats();
        fetchUser();
    }, []);

    const fetchStats = async () => {
        try {
            const accessToken = localStorage.getItem('access_token');
            const res = await fetch('/api/stats', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSquatStats(data.stats);
            }
        } catch (err) { /* ignore */ }
    };

    const fetchPushupStats = async () => {
        try {
            const accessToken = localStorage.getItem('access_token');
            const res = await fetch('/api/pushup-stats', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPushupStats(data.stats);
            }
        } catch (err) { /* ignore */ }
    };

    const fetchUser = async () => {
        try {
            const accessToken = localStorage.getItem('access_token');
            const res = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                setForm({ username: data.user.username, email: data.user.email });
            }
        } catch (err) { /* ignore */ }
    };

    const handleEdit = () => {
        setEditMode(true);
        setMessage('');
        setError('');
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        try {
            const accessToken = localStorage.getItem('access_token');
            // Assume PATCH /api/profile for updating user info (implement in backend if not present)
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                setMessage('Profile updated successfully!');
                setEditMode(false);
                fetchUser();
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to update profile');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6 flex flex-col items-center">
            <div className="w-full max-w-2xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-xl mt-8">
                <h1 className="text-3xl font-bold text-white mb-6 text-center">Dashboard</h1>
                <table className="w-full mb-8 text-white text-lg">
                    <thead>
                        <tr>
                            <th className="py-2">Exercise</th>
                            <th className="py-2">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="py-2">Squats</td>
                            <td className="py-2">{squatStats ? squatStats.total_squats : '-'}</td>
                        </tr>
                        <tr>
                            <td className="py-2">Pushups</td>
                            <td className="py-2">{pushupStats ? pushupStats.total_pushups : '-'}</td>
                        </tr>
                    </tbody>
                </table>
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-white mb-2">User Details</h2>
                    {user && !editMode && (
                        <div className="text-white mb-2">
                            <div><b>Username:</b> {user.username}</div>
                            <div><b>Email:</b> {user.email}</div>
                            <button onClick={handleEdit} className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold">Edit</button>
                        </div>
                    )}
                    {editMode && (
                        <form onSubmit={handleSave} className="space-y-2">
                            <input
                                type="text"
                                name="username"
                                value={form.username}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                                required
                            />
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                                required
                            />
                            <div className="flex gap-2">
                                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold">Save</button>
                                <button type="button" onClick={() => setEditMode(false)} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold">Cancel</button>
                            </div>
                        </form>
                    )}
                    {message && <div className="text-green-300 mt-2">{message}</div>}
                    {error && <div className="text-red-300 mt-2">{error}</div>}
                </div>
            </div>
        </div>
    );
};

export default Dashboard; 