import React from 'react';
import { motion } from 'framer-motion';
import { Play, Type, Image as ImageIcon, Video, Layers, ChevronRight } from 'lucide-react';
import { DEMO_CASES } from '../lib/demos';

const TYPE_ICONS = {
  video: <Video size={14} />,
  image: <ImageIcon size={14} />,
  text: <Type size={14} />,
  multimodal: <Layers size={14} />
};

export default function DemoGallery({ onSelect }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-6">
      {DEMO_CASES.map((demo) => (
        <motion.button
          key={demo.id}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(demo)}
          className="flex flex-col text-left bg-white dark:bg-[#1e1e21] border border-gray-200/60 dark:border-white/[0.10] rounded-[1.25rem] overflow-hidden transition-all group hover:border-blue-500/50 dark:hover:border-blue-500/50"
        >
          {/* Header/Status */}
          <div className="px-4 py-3 bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-between border-b border-gray-200/60 dark:border-white/[0.05]">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 dark:text-gray-500">
                {TYPE_ICONS[demo.type]}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                {demo.type}
              </span>
            </div>
            <span className="text-[10px] font-medium text-gray-400">#{demo.id}</span>
          </div>

          <div className="p-4 flex flex-col flex-grow">
            <h3 className="text-[13px] font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-500 transition-colors">
              {demo.title}
            </h3>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 flex-grow">
              {demo.description}
            </p>
            
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-white/[0.05]">
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-300 rounded-md">
                {demo.platform}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                Load <ChevronRight size={14} />
              </span>
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
