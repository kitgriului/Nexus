
import React from 'react';
import { MediaItem } from '../types';
import { Icon } from './Icons';

interface FeedItemProps {
  item: MediaItem;
  onClick: (id: string) => void;
  onTagClick: (tag: string) => void;
}

export const FeedItem: React.FC<FeedItemProps> = ({ item, onClick, onTagClick }) => {
  const isProcessing = item.status === 'processing';

  const getIcon = () => {
    if (item.type === 'youtube' || item.type === 'video') return 'play-circle';
    if (item.type === 'audio') return 'mic';
    if (item.type === 'chat_session') return 'message-square';
    return 'globe';
  };

  return (
    <div 
      className={`group relative bg-white border border-gray-100 p-5 rounded-[2rem] mb-4 shadow-sm hover:shadow-xl transition-all cursor-pointer ${isProcessing ? 'animate-pulse' : ''}`}
      onClick={() => onClick(item.id)}
    >
      <div className="flex items-start gap-4">
        <div className={`p-4 rounded-2xl transition-all ${isProcessing ? 'bg-purple-50 text-purple-400' : 'bg-gray-50 text-gray-400 group-hover:bg-black group-hover:text-white'}`}>
          <Icon name={getIcon()} size={24} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <h3 className="text-base font-bold text-gray-900 leading-tight truncate pr-4">{item.title}</h3>
            <span className="text-[10px] font-black uppercase text-gray-300 shrink-0">
              {new Date(item.createdAt).toLocaleDateString()}
            </span>
          </div>
          
          <p className="text-xs text-gray-500 line-clamp-2 mb-3 font-medium leading-relaxed">
            {item.aiSummary || (isProcessing ? "Analyzing material..." : "No summary available.")}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {item.tags?.map(tag => (
              <button 
                key={tag}
                onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
                className="px-2.5 py-1 bg-gray-50 text-[9px] font-bold uppercase tracking-wider text-gray-400 rounded-lg hover:bg-purple-50 hover:text-purple-500 transition-colors"
              >
                #{tag}
              </button>
            ))}
            {item.origin === 'subscription' && (
              <span className="px-2.5 py-1 bg-blue-50 text-[9px] font-bold uppercase tracking-wider text-blue-400 rounded-lg">Source</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
