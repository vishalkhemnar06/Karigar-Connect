import { getImageUrl } from '../../constants/config';
import React, { useState, useEffect } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { Trophy } from 'lucide-react';

const Leaderboard = () => {
    const [leaders, setLeaders] = useState([]);

    useEffect(() => {
        const fetchLeaders = async () => {
            try {
                const { data } = await api.getLeaderboard();
                setLeaders(data);
            } catch (error) {
                toast.error("Could not fetch leaderboard.");
            }
        };
        fetchLeaders();
    }, []);

    const rankColor = (index) => {
        if (index === 0) return "border-yellow-400";
        if (index === 1) return "border-gray-300";
        if (index === 2) return "border-yellow-600";
        return "border-gray-200";
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Top Karigars Leaderboard</h1>
            <div className="bg-white rounded-lg shadow-sm">
                <ul className="divide-y divide-gray-200">
                    {leaders.map((leader, index) => (
                        <li key={leader._id} className="p-4 flex items-center space-x-4">
                            <span className={`text-xl font-bold w-8 text-center ${index < 3 ? 'text-orange-500' : 'text-gray-500'}`}>{index + 1}</span>
                            <img src={getImageUrl(leader.photo, `https://ui-avatars.com/api/?name=${leader.name}`)} alt={leader.name} className={`h-12 w-12 rounded-full object-cover border-4 ${rankColor(index)}`}/>
                            <div className="flex-grow">
                                <p className="font-bold text-gray-800">{leader.name}</p>
                                <p className="text-sm text-gray-500">{leader.karigarId}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-orange-600">{leader.points} Points</p>
                                {index < 3 && <Trophy size={20} className={rankColor(index).replace('border', 'text')}/>}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default Leaderboard;