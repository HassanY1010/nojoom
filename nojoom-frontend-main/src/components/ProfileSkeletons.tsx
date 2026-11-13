import React from 'react';

export const ProfileHeaderSkeleton: React.FC = () => {
    return (
        <div className="bg-[#121212] rounded-2xl p-6 mb-6 border border-gray-800 animate-pulse">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar Skeleton */}
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-800 shrink-0"></div>

                <div className="flex-1 w-full space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
                        <div className="space-y-2 w-full sm:w-auto">
                            <div className="h-8 bg-gray-800 rounded-lg w-48 mx-auto sm:mx-0"></div>
                            <div className="h-4 bg-gray-800 rounded-md w-64 mx-auto sm:mx-0"></div>
                        </div>
                        {/* Buttons Skeleton */}
                        <div className="flex gap-2 w-full sm:w-auto justify-center">
                            <div className="h-10 bg-gray-800 rounded-full w-28"></div>
                            <div className="h-10 bg-gray-800 rounded-full w-28"></div>
                        </div>
                    </div>

                    {/* Stats Skeleton */}
                    <div className="flex justify-center sm:justify-start gap-8 pt-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="text-center space-y-2">
                                <div className="h-6 bg-gray-800 rounded w-12 mx-auto"></div>
                                <div className="h-3 bg-gray-800 rounded w-16 mx-auto"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ProfileTabsSkeleton: React.FC = () => {
    return (
        <div className="flex justify-center mb-8 animate-pulse">
            <div className="bg-[#121212] p-1 rounded-xl flex gap-2 w-full max-w-md border border-gray-800">
                <div className="h-10 bg-gray-800 rounded-lg flex-1"></div>
                <div className="h-10 bg-gray-800 rounded-lg flex-1"></div>
            </div>
        </div>
    );
};
