// import React, { useState, JSX } from 'react';
// import { 
//   FileText, 
//   File, 
//   Download, 
//   Play, 
//   Image as ImageIcon, 
//   FileArchive, 
//   FileCode, 
//   X,
//   FileCheck2,
//   FileSpreadsheet
// } from 'lucide-react';

// interface Attachment {
//   name: string;
//   size: string;
//   url?: string;
//   mimeType?: string;
//   resourceType?: string;
// }

// interface ChatMessageProps {
//   message: {
//     id: string;
//     sender: 'me' | 'them';
//     text: string;
//     timestamp: string;
//     isRead?: boolean;
//     attachment?: Attachment;
//   };
//   avatar?: string;
//   initials?: string;
// }

// function MediaModal({ url, name, mimeType, onClose }: { url: string; name: string; mimeType?: string; onClose: () => void }) {
//   const isVideo = (mimeType ?? '').startsWith('video/');
  
//   return (
//     <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 p-4 sm:p-8" onClick={onClose}>
//       <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center text-white bg-black/20">
//         <h3 className="text-sm font-medium truncate pr-8">{name}</h3>
//         <button 
//           onClick={onClose}
//           className="p-2 hover:bg-white/10 rounded-full transition-colors"
//         >
//           <X className="w-6 h-6" />
//         </button>
//       </div>
      
//       <div className="w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
//         {isVideo ? (
//           <video src={url} controls autoPlay className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
//         ) : (
//           <img src={url} alt={name} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
//         )}
//       </div>
      
//       <div className="mt-6 flex gap-4">
//         <a 
//           href={`/api/chat/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`}
//           download={name}
//           className="flex items-center gap-2 px-6 py-3 bg-[#CC7000] text-white rounded-full font-semibold hover:bg-[#A85C00] transition-colors shadow-lg"
//           onClick={(e) => e.stopPropagation()}
//         >
//           <Download className="w-5 h-5" />
//           Download
//         </a>
//       </div>
//     </div>
//   );
// }

// function FileAttachment({ attachment }: { attachment: Attachment }) {
//   const [showModal, setShowModal] = useState(false);
//   const mime = attachment.mimeType ?? '';
//   const isImage = mime.startsWith('image/');
//   const isVideo = mime.startsWith('video/') || attachment.resourceType === 'video';
//   const isPdf = mime === 'application/pdf' || attachment.name.toLowerCase().endsWith('.pdf');
//   const isDoc = mime.includes('word') || attachment.name.toLowerCase().endsWith('.doc') || attachment.name.toLowerCase().endsWith('.docx');
//   const isSpreadsheet = mime.includes('excel') || mime.includes('spreadsheet') || attachment.name.toLowerCase().endsWith('.xls') || attachment.name.toLowerCase().endsWith('.xlsx');

//   const getFileIcon = () => {
//     if (isPdf) return <FileText className="w-5 h-5 text-red-500" />;
//     if (isDoc) return <FileText className="w-5 h-5 text-blue-500" />;
//     if (isSpreadsheet) return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
//     if (isVideo) return <Play className="w-5 h-5 text-[#CC7000]" />;
//     if (isImage) return <ImageIcon className="w-5 h-5 text-purple-500" />;
//     return <File className="w-5 h-5 text-gray-400" />;
//   };

//   const onDownloadClick = (e: React.MouseEvent) => {
//     e.preventDefault();
//     e.stopPropagation();
//     if (!attachment.url) return;

//     // 🚀 Using a direct link to our proxy is the only way to FORCE a download for PDFs
//     // cross-origin (from Cloudinary). Client-side fetching often hits CORS blocks.
//     const proxyUrl = `/api/chat/download?url=${encodeURIComponent(attachment.url)}&name=${encodeURIComponent(attachment.name)}`;
    
//     // We use a temporary link to ensure the 'download' behavior is respected
//     const link = document.createElement('a');
//     link.href = proxyUrl;
//     link.download = attachment.name;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   const onPreviewClick = (e: React.MouseEvent) => {
//     if (isImage || isVideo) {
//       setShowModal(true);
//     } else {
//       // For all other files, trigger direct download
//       void onDownloadClick(e);
//     }
//   };

//   return (
//     <div className="mt-3 space-y-2 max-w-full">
//       {/* 🖼️ MEDIA PREVIEW (FOR IMAGES/VIDEOS) */}
//       {(isImage || isVideo) && attachment.url && (
//         <div 
//           onClick={onPreviewClick}
//           className="relative group cursor-pointer overflow-hidden rounded-xl border border-[#e8dfd4] bg-[#f5f0ea] hover:shadow-md transition-all duration-300"
//         >
//           {isImage ? (
//             <img 
//               src={attachment.url} 
//               alt={attachment.name} 
//               className="max-h-[300px] w-full object-cover transition-transform duration-500 group-hover:scale-105" 
//             />
//           ) : (
//             <div className="relative aspect-video flex items-center justify-center bg-[#1a1a1a]">
//               <video src={attachment.url} className="w-full h-full object-contain opacity-80" />
//               <div className="absolute inset-0 flex items-center justify-center">
//                 <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center ring-1 ring-white/30 group-hover:scale-110 transition-transform">
//                   <Play className="w-8 h-8 text-white fill-white" />
//                 </div>
//               </div>
//             </div>
//           )}
          
//           <div className="absolute top-2 right-2 flex gap-2 translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
//             <button 
//               onClick={onDownloadClick}
//               className="p-2 bg-black/50 hover:bg-[#CC7000] text-white rounded-lg backdrop-blur-sm shadow-xl transition-colors"
//             >
//               <Download className="w-4 h-4" />
//             </button>
//           </div>
//         </div>
//       )}

//       {/* 📄 FILE ITEM (FOR DOCUMENTS AND GENERAL FILES) */}
//       <div 
//         onClick={onPreviewClick}
//         className={`
//           flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer group/item
//           ${(isImage || isVideo) ? 'bg-[#FAF8F5] border-[#E8E2D9]' : 'bg-white border-[#E8E2D9] hover:border-[#CC7000] shadow-sm hover:shadow-md'}
//         `}
//       >
//         <div className="flex-shrink-0 w-11 h-11 bg-white border border-[#E8E2D9] rounded-xl flex items-center justify-center shadow-sm group-hover/item:scale-105 transition-transform">
//           {getFileIcon()}
//         </div>

//         <div className="flex-1 min-w-0">
//           <p className="text-sm font-bold text-[#1A1A1A] truncate pr-2 leading-tight">
//             {attachment.name}
//           </p>
//           <div className="flex items-center gap-2 mt-1">
//             <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase">
//               {attachment.size}
//             </span>
//             <span className="text-[11px] font-medium text-gray-500 truncate">
//               {isPdf ? 'PDF Document' : isDoc ? 'Word Doc' : isSpreadsheet ? 'Spreadsheet' : isImage ? 'Image' : isVideo ? 'Video' : 'File'}
//             </span>
//           </div>
//         </div>

//         <button
//           onClick={onDownloadClick}
//           className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#CC7000] border border-transparent hover:border-[#CC7000] rounded-xl transition-all"
//           title="Download File"
//         >
//           <Download className="w-4.5 h-4.5" />
//         </button>
//       </div>

//       {showModal && attachment.url && (
//         <MediaModal 
//           url={attachment.url} 
//           name={attachment.name} 
//           mimeType={attachment.mimeType}
//           onClose={() => setShowModal(false)} 
//         />
//       )}
//     </div>
//   );
// }

// function DoubleCheckIcon({ className }: { className?: string }) {
//   return (
//     <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className={className}>
//       <path d="M1 5L4.5 8.5L10 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
//       <path d="M5 5L8.5 8.5L14 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
//     </svg>
//   );
// }

// function formatMessageText(text: string) {
//   const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[\w\-\/\.\?\#\=\&\%]+)\)/g;
//   const urlRegex = /(https?:\/\/[^\s]+|\/[\w\-\/\.\?\#\=\&\%]+)/g;
//   const elements: Array<JSX.Element | string> = [];
//   let lastIndex = 0;
//   let match: RegExpExecArray | null;

//   const pushTextWithUrls = (value: string) => {
//     const parts = value.split(urlRegex).filter(Boolean);
//     parts.forEach((part, index) => {
//       if (urlRegex.test(part)) {
//         elements.push(
//           <a
//             key={`link-${elements.length}-${index}`}
//             href={part}
//             className="inline-flex items-center rounded-full bg-[#CC7000] px-3 py-1 text-[#fff] underline-offset-4 transition-colors hover:bg-[#b45e00]"
//           >
//             {part}
//           </a>
//         );
//         return;
//       }
//       elements.push(part);
//     });
//   };

//   while ((match = markdownLinkRegex.exec(text)) !== null) {
//     if (match.index > lastIndex) {
//       pushTextWithUrls(text.slice(lastIndex, match.index));
//     }

//     const [, label, url] = match;
//     elements.push(
//       <a
//         key={`markdown-link-${elements.length}`}
//         href={url}
//         className="inline-flex items-center rounded-full bg-[#CC7000] px-3 py-1 text-[#fff] underline-offset-4 transition-colors hover:bg-[#b45e00]"
//       >
//         {label}
//       </a>
//     );

//     lastIndex = match.index + match[0].length;
//   }

//   if (lastIndex < text.length) {
//     pushTextWithUrls(text.slice(lastIndex));
//   }

//   return elements;
// }

// export default function ChatMessage({ message, avatar, initials = 'SN' }: ChatMessageProps) {
//   const isMe = message.sender === 'me';

//   return (
//     <div className={`flex items-end gap-2 mb-4 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
//       {isMe ? (
//         <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#CC7000] flex items-center justify-center text-white text-xs font-semibold mb-1 shadow-sm">
//           {initials}
//         </div>
//       ) : (
//         <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gray-200 mb-1 border border-[#e8dfd4] shadow-sm">
//           {avatar ? (
//             <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
//           ) : (
//             <div className="w-full h-full bg-[#e8dfd4] flex items-center justify-center text-[#8C4F00] text-xs font-bold font-serif italic">B</div>
//           )}
//         </div>
//       )}

//       <div
//         className={`
//         max-w-[78%] px-4 py-3 rounded-2xl shadow-sm
//         ${isMe ? 'bg-[#CC7000] text-white rounded-br-md shadow-orange-950/10' : 'bg-white text-[#232323] border border-[#ece7df] rounded-bl-md shadow-gray-200'}
//       `}
//       >
//         {message.text ? (
//           <p className="text-sm leading-relaxed whitespace-pre-line break-all">
//             {formatMessageText(message.text)}
//           </p>
//         ) : null}

//         {message.attachment ? <FileAttachment attachment={message.attachment} /> : null}

//         <div className={`flex items-center gap-1 mt-1.5 text-[10px] sm:text-xs font-medium tracking-wide uppercase ${isMe ? 'justify-end text-orange-100/70' : 'text-gray-400'}`}>
//           <span>{message.timestamp}</span>
//           {isMe && message.isRead && <DoubleCheckIcon className="text-orange-200 w-3.5" />}
//         </div>
//       </div>
//     </div>
//   );
// }


import React, { useState, useEffect, JSX } from 'react';
import {
  FileText,
  File,
  Download,
  Play,
  Image as ImageIcon,
  FileSpreadsheet,
  X,
  Globe,
  Link as LinkIcon,
} from 'lucide-react';

interface Attachment {
  name: string;
  size: string;
  url?: string;
  mimeType?: string;
  resourceType?: string;
}

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
  favicon?: string;
}

interface ChatMessageProps {
  message: {
    id: string;
    sender: 'me' | 'them';
    text: string;
    timestamp: string;
    isRead?: boolean;
    attachment?: Attachment;
  };
  avatar?: string;
  initials?: string;
}

// ─── Media Modal ────────────────────────────────────────────────────────────
function MediaModal({
  url,
  name,
  mimeType,
  onClose,
}: {
  url: string;
  name: string;
  mimeType?: string;
  onClose: () => void;
}) {
  const isVideo = (mimeType ?? '').startsWith('video/');

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 p-4 sm:p-8"
      onClick={onClose}
    >
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center text-white bg-black/20">
        <h3 className="text-sm font-medium truncate pr-8">{name}</h3>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div
        className="w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
          />
        ) : (
          <img
            src={url}
            alt={name}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
          />
        )}
      </div>

      <div className="mt-6 flex gap-4">
        <a
          href={`/api/chat/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`}
          download={name}
          className="flex items-center gap-2 px-6 py-3 bg-[#CC7000] text-white rounded-full font-semibold hover:bg-[#A85C00] transition-colors shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-5 h-5" />
          Download
        </a>
      </div>
    </div>
  );
}

// ─── Link Preview Card ───────────────────────────────────────────────────────
function LinkPreviewCard({
  preview,
  isMe,
}: {
  preview: LinkPreview;
  isMe: boolean;
}) {
  const domain = preview.domain ?? (() => {
    try { return new URL(preview.url).hostname.replace('www.', ''); } catch { return preview.url; }
  })();

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        block mt-2 rounded-xl overflow-hidden border transition-all hover:opacity-90
        ${isMe
          ? 'border-orange-400/30 bg-[#b86200]'
          : 'border-[#e0d9d0] bg-[#f9f6f2]'}
      `}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Thumbnail */}
      {preview.image && (
        <div className="w-full h-[140px] overflow-hidden bg-gray-200">
          <img
            src={preview.image}
            alt={preview.title ?? 'Link preview'}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Text body */}
      <div className="px-3 py-2.5">
        {/* Domain row */}
        <div className="flex items-center gap-1.5 mb-1">
          {preview.favicon ? (
            <img src={preview.favicon} alt="" className="w-3.5 h-3.5 rounded-sm" />
          ) : (
            <Globe className={`w-3 h-3 ${isMe ? 'text-orange-200' : 'text-gray-400'}`} />
          )}
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider truncate ${
              isMe ? 'text-orange-200' : 'text-gray-400'
            }`}
          >
            {domain}
          </span>
        </div>

        {/* Title */}
        {preview.title && (
          <p
            className={`text-sm font-bold leading-snug line-clamp-2 ${
              isMe ? 'text-white' : 'text-[#1A1A1A]'
            }`}
          >
            {preview.title}
          </p>
        )}

        {/* Description */}
        {preview.description && (
          <p
            className={`text-xs mt-0.5 line-clamp-2 leading-relaxed ${
              isMe ? 'text-orange-100/80' : 'text-gray-500'
            }`}
          >
            {preview.description}
          </p>
        )}
      </div>

      {/* URL footer bar — WhatsApp style */}
      <div
        className={`px-3 py-1.5 border-t text-[11px] truncate ${
          isMe
            ? 'border-orange-400/30 text-orange-200/70'
            : 'border-[#e0d9d0] text-gray-400'
        }`}
      >
        {preview.url}
      </div>
    </a>
  );
}

// ─── File Attachment ─────────────────────────────────────────────────────────
function FileAttachment({
  attachment,
  isMe,
}: {
  attachment: Attachment;
  isMe: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const mime = attachment.mimeType ?? '';
  const isImage = mime.startsWith('image/') || attachment.resourceType === 'image';
  const isVideo =
    mime.startsWith('video/') || attachment.resourceType === 'video';
  const isPdf =
    mime === 'application/pdf' ||
    attachment.name.toLowerCase().endsWith('.pdf');
  const isDoc =
    mime.includes('word') ||
    attachment.name.toLowerCase().endsWith('.doc') ||
    attachment.name.toLowerCase().endsWith('.docx');
  const isSpreadsheet =
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    attachment.name.toLowerCase().endsWith('.xls') ||
    attachment.name.toLowerCase().endsWith('.xlsx');

  const getFileIcon = () => {
    if (isPdf) return <FileText className="w-5 h-5 text-red-500" />;
    if (isDoc) return <FileText className="w-5 h-5 text-blue-500" />;
    if (isSpreadsheet) return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    if (isVideo) return <Play className="w-5 h-5 text-[#CC7000]" />;
    if (isImage) return <ImageIcon className="w-5 h-5 text-purple-500" />;
    return <File className="w-5 h-5 text-gray-400" />;
  };

  const onDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!attachment.url) return;
    const proxyUrl = `/api/chat/download?url=${encodeURIComponent(attachment.url)}&name=${encodeURIComponent(attachment.name)}`;
    const link = document.createElement('a');
    link.href = proxyUrl;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onPreviewClick = (e: React.MouseEvent) => {
    if (isImage || isVideo) {
      setShowModal(true);
    } else {
      void onDownloadClick(e);
    }
  };

  // ── IMAGE / VIDEO — NO filename row, just the media ──────────────────────
  if (isImage || isVideo) {
    return (
      <div className="mt-2 max-w-full">
        <div
          onClick={onPreviewClick}
          className="relative group cursor-pointer overflow-hidden rounded-xl"
          style={{ maxWidth: 260 }}
        >
          {isImage ? (
            <img
              src={attachment.url}
              alt=""
              className="w-full max-h-[260px] object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="relative aspect-video flex items-center justify-center bg-black rounded-xl overflow-hidden">
              <video
                src={attachment.url}
                className="w-full h-full object-contain opacity-80"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center ring-1 ring-white/30 group-hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 text-white fill-white" />
                </div>
              </div>
            </div>
          )}

          {/* Download button — top-right, appears on hover */}
          <button
            onClick={onDownloadClick}
            className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-[#CC7000] text-white rounded-lg backdrop-blur-sm shadow-xl transition-colors opacity-0 group-hover:opacity-100 translate-y-[-6px] group-hover:translate-y-0 transition-all"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {showModal && attachment.url && (
          <MediaModal
            url={attachment.url}
            name={attachment.name}
            mimeType={attachment.mimeType}
            onClose={() => setShowModal(false)}
          />
        )}
      </div>
    );
  }

  // ── DOCUMENT / FILE — show name + size ───────────────────────────────────
  return (
    <div className="mt-2 max-w-full">
      <div
        onClick={onPreviewClick}
        className={`
          flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer group/item
          ${isMe
            ? 'bg-[#b86200] border-orange-400/30 hover:bg-[#a35500]'
            : 'bg-white border-[#E8E2D9] hover:border-[#CC7000] shadow-sm hover:shadow-md'}
        `}
      >
        <div
          className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center shadow-sm group-hover/item:scale-105 transition-transform
            ${isMe ? 'bg-[#CC7000] border border-orange-300/40' : 'bg-white border border-[#E8E2D9]'}`}
        >
          {getFileIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-bold truncate pr-2 leading-tight ${
              isMe ? 'text-white' : 'text-[#1A1A1A]'
            }`}
          >
            {attachment.name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-[11px] font-bold px-1.5 py-0.5 rounded uppercase ${
                isMe
                  ? 'bg-orange-400/30 text-orange-100'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {attachment.size}
            </span>
            <span
              className={`text-[11px] font-medium truncate ${
                isMe ? 'text-orange-200' : 'text-gray-500'
              }`}
            >
              {isPdf
                ? 'PDF Document'
                : isDoc
                ? 'Word Doc'
                : isSpreadsheet
                ? 'Spreadsheet'
                : 'File'}
            </span>
          </div>
        </div>

        <button
          onClick={onDownloadClick}
          className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all
            ${isMe
              ? 'text-orange-200 hover:text-white hover:bg-orange-400/40 border border-orange-300/30'
              : 'text-gray-400 hover:text-white hover:bg-[#CC7000] border border-transparent hover:border-[#CC7000]'}`}
          title="Download File"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Double tick icon ────────────────────────────────────────────────────────
function DoubleCheckIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className={className}>
      <path d="M1 5L4.5 8.5L10 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 5L8.5 8.5L14 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── URL detection helpers ────────────────────────────────────────────────────
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function extractUrls(text: string): string[] {
  return Array.from(text.matchAll(URL_REGEX), (m) => m[1]);
}

// Fetch link preview via a public meta-scraper (or your own endpoint)
async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    // Replace this with your own /api/link-preview?url=... endpoint
    // For demo we just return a minimal object parsed from the URL itself
    const res = await fetch(
      `/api/link-preview?url=${encodeURIComponent(url)}`
    );
    if (!res.ok) throw new Error('failed');
    return (await res.json()) as LinkPreview;
  } catch {
    // Fallback: return bare url so we still render a basic card
    const domain = (() => {
      try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
    })();
    return { url, domain };
  }
}

// ─── Message text renderer ───────────────────────────────────────────────────
function formatMessageText(text: string, isMe: boolean) {
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[\w\-\/\.\?\#\=\&\%]+)\)/g;
  const urlRegex = /(https?:\/\/[^\s]+|\/[\w\-\/\.\?\#\=\&\%]+)/g;
  const elements: Array<JSX.Element | string> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushTextWithUrls = (value: string) => {
    const parts = value.split(urlRegex).filter(Boolean);
    parts.forEach((part, index) => {
      if (urlRegex.test(part)) {
        elements.push(
          <a
            key={`link-${elements.length}-${index}`}
            href={part}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 underline-offset-4 transition-colors text-[#fff]
              ${isMe ? 'bg-[#b86200] hover:bg-[#9a5200]' : 'bg-[#CC7000] hover:bg-[#b45e00]'}`}
          >
            <LinkIcon className="w-3 h-3" />
            {part}
          </a>
        );
        return;
      }
      elements.push(part);
    });
  };

  while ((match = markdownLinkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushTextWithUrls(text.slice(lastIndex, match.index));
    }
    const [, label, url] = match;
    elements.push(
      <a
        key={`markdown-link-${elements.length}`}
        href={url}
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-white underline-offset-4 transition-colors
          ${isMe ? 'bg-[#b86200] hover:bg-[#9a5200]' : 'bg-[#CC7000] hover:bg-[#b45e00]'}`}
      >
        <LinkIcon className="w-3 h-3" />
        {label}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    pushTextWithUrls(text.slice(lastIndex));
  }

  return elements;
}

// ─── Main ChatMessage ─────────────────────────────────────────────────────────
export default function ChatMessage({
  message,
  avatar,
  initials = 'SN',
}: ChatMessageProps) {
  const isMe = message.sender === 'me';
  const [linkPreviews, setLinkPreviews] = useState<LinkPreview[]>([]);

  // Detect URLs in text and fetch previews
  useEffect(() => {
    const urls = extractUrls(message.text);
    if (urls.length === 0) return;
    let cancelled = false;
    Promise.all(urls.map(fetchLinkPreview)).then((results) => {
      if (!cancelled) {
        setLinkPreviews(results.filter(Boolean) as LinkPreview[]);
      }
    });
    return () => { cancelled = true; };
  }, [message.text]);

  return (
    <div className={`flex items-end gap-2 mb-4 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {isMe ? (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#CC7000] flex items-center justify-center text-white text-xs font-semibold mb-1 shadow-sm">
          {initials}
        </div>
      ) : (
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gray-200 mb-1 border border-[#e8dfd4] shadow-sm">
          {avatar ? (
            <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#e8dfd4] flex items-center justify-center text-[#8C4F00] text-xs font-bold font-serif italic">
              B
            </div>
          )}
        </div>
      )}

      {/* Bubble */}
      <div
        className={`
          max-w-[78%] px-4 py-3 rounded-2xl shadow-sm
          ${isMe
            ? 'bg-[#CC7000] text-white rounded-br-md shadow-orange-950/10'
            : 'bg-white text-[#232323] border border-[#ece7df] rounded-bl-md shadow-gray-200'}
        `}
      >
        {/* Text */}
        {message.text ? (
          <p className="text-sm leading-relaxed whitespace-pre-line break-all">
            {formatMessageText(message.text, isMe)}
          </p>
        ) : null}

        {/* Link previews (WhatsApp-style) */}
        {linkPreviews.map((preview, i) => (
          <LinkPreviewCard key={i} preview={preview} isMe={isMe} />
        ))}

        {/* Attachment */}
        {message.attachment ? (
          <FileAttachment attachment={message.attachment} isMe={isMe} />
        ) : null}

        {/* Timestamp + read receipt */}
        <div
          className={`flex items-center gap-1 mt-1.5 text-[10px] sm:text-xs font-medium tracking-wide uppercase ${
            isMe ? 'justify-end text-orange-100/70' : 'text-gray-400'
          }`}
        >
          <span>{message.timestamp}</span>
          {isMe && message.isRead && <DoubleCheckIcon className="text-orange-200 w-3.5" />}
        </div>
      </div>
    </div>
  );
}