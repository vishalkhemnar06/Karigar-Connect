import React, { useState, useEffect } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { Star } from 'lucide-react';

const Feedback = () => {
    const [feedback, setFeedback] = useState([]);

    useEffect(() => {
        const fetchFeedback = async () => {
            try {
                const { data } = await api.getMyFeedback();
                setFeedback(data);
            } catch (error) {
                toast.error("Could not fetch feedback.");
            }
        };
        fetchFeedback();
    }, []);

    const StarRating = ({ rating }) => (
        <div className="flex">
            {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} className={i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}/>
            ))}
        </div>
    );

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">My Feedback & Ratings</h1>
            <div className="space-y-4">
                {feedback.map(item => (
                    <div key={item._id} className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold">{item.jobId.title}</p>
                                <p className="text-sm text-gray-500">From: {item.client.name}</p>
                            </div>
                            <div className="text-right">
                                <StarRating rating={item.stars} />
                                <p className="text-sm font-semibold text-orange-600">{item.points} Points Awarded</p>
                            </div>
                        </div>
                        <p className="text-gray-700 mt-2 italic">"{item.message}"</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Feedback;