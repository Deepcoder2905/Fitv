import React, { useState } from 'react';
import { Loader } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const Article = () => {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const res = await fetch(`/api/exercise-ai?query=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error('Failed to fetch AI summary');
            const data = await res.json();
            setResult(data);
        } catch (err) {
            setError('Failed to fetch exercise info. Please try again.');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6 flex flex-col items-center">
            <style>{`
                .markdown-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 1rem;
                }
                .markdown-table th, .markdown-table td {
                    border: 1px solid #a5b4fc;
                    padding: 0.5rem 1rem;
                    color: #dbeafe;
                }
                .markdown-table th {
                    background: #312e81;
                    font-weight: bold;
                }
            `}</style>
            <div className="w-full max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold text-white mb-8 text-center">AI Exercise Info</h1>
                <form onSubmit={handleSearch} className="flex gap-2 mb-8">
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Enter exercise name (e.g., Squat, Push-Up)"
                        className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold text-lg transition-colors"
                        disabled={loading}
                    >
                        {loading ? <Loader className="w-6 h-6 animate-spin" /> : 'Search'}
                    </button>
                </form>
                {error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center">{error}</div>
                )}
                {result && (
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl mt-6">
                        <h2 className="text-2xl font-bold text-white mb-4 text-center">{result.name}</h2>
                        <div className="text-blue-100 text-lg">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    table: ({ node, ...props }) => (
                                        <table className="markdown-table" {...props} />
                                    )
                                }}
                            >
                                {result.summary}
                            </ReactMarkdown>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Article;