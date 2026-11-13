import React from 'react';

export const CardSkeleton: React.FC = () => {
    return (
        <div className="bg-[#0a0a0a] rounded-2xl overflow-hidden border border-gray-800 animate-pulse">
            <div className="aspect-[9/16] w-full bg-gray-900"></div>
            <div className="p-3">
                <div className="h-4 bg-gray-900 rounded-md w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-900 rounded-md w-1/2 mb-4"></div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gray-900"></div>
                        <div className="w-12 h-2 bg-gray-900 rounded-md"></div>
                    </div>
                    <div className="w-8 h-2 bg-gray-900 rounded-md"></div>
                </div>
            </div>
        </div>
    );
};

export const UserSkeleton: React.FC = () => {
    return (
        <div className="bg-[#0a0a0a] rounded-2xl p-5 border border-gray-800 animate-pulse flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-gray-900 mb-4"></div>
            <div className="h-4 bg-gray-900 rounded-md w-24 mb-2"></div>
            <div className="h-3 bg-gray-900 rounded-md w-16 mb-4"></div>
            <div className="h-8 bg-gray-900 rounded-xl w-full"></div>
        </div>
    );
};
