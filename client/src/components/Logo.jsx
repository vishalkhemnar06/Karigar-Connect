import React from 'react';
import { Wrench } from 'lucide-react';

const Logo = () => {
    return (
        <div className="flex items-center space-x-2">
            <Wrench className="text-orange-500" size={28} />
            <span className="text-2xl font-bold text-gray-800">
                Karigar<span className="text-orange-500">Connect</span>
            </span>
        </div>
    );
};

export default Logo;