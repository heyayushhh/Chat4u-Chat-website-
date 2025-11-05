import { Download, FileText, Video, Image as ImageIcon } from "lucide-react";
import { useState } from "react";

const FileAttachment = ({ file, onDownload, isDownloading, progress }) => {
  const [imageError, setImageError] = useState(false);

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return <ImageIcon size={20} />;
    if (type.startsWith('video/')) return <Video size={20} />;
    return <FileText size={20} />;
  };

  const getFileTypeLabel = (type) => {
    if (type.startsWith('image/')) return 'Image';
    if (type.startsWith('video/')) return 'Video';
    if (type === 'application/pdf') return 'PDF';
    if (type.includes('word')) return 'Word';
    if (type.includes('excel') || type.includes('sheet')) return 'Excel';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'PowerPoint';
    if (type === 'text/plain') return 'Text';
    return 'File';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // For images, show the image with download overlay
  if (file.type.startsWith('image/') && !imageError) {
    return (
      <div className="relative group sm:max-w-[200px] mb-2">
        <img
          src={file.url}
          alt={file.name}
          className="w-full rounded-md"
          onError={() => setImageError(true)}
        />
        {/* Download button overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-md flex items-center justify-center">
          <button
            onClick={() => onDownload(file.url, file.name)}
            disabled={isDownloading}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-800 p-2 rounded-full shadow-lg disabled:opacity-50"
            title="Download image"
          >
            {isDownloading ? (
              typeof progress === 'number' && progress >= 0 ? (
                <span className="text-xs font-semibold">{progress}%</span>
              ) : (
                <div className="animate-spin w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full"></div>
              )
            ) : (
              <Download size={16} />
            )}
          </button>
        </div>
        {isDownloading && typeof progress === 'number' ? (
          <div className="absolute left-0 right-0 bottom-0 p-2">
            <div className="h-1 bg-black/30 rounded">
              <div className="h-1 bg-white rounded" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // For videos, show video player
  if (file.type.startsWith('video/')) {
    return (
      <div className="relative group sm:max-w-[300px] mb-2">
        <video
          src={file.url}
          controls
          className="w-full rounded-md"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
        <div className="absolute top-2 right-2">
          <button
            onClick={() => onDownload(file.url, file.name)}
            disabled={isDownloading}
            className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-1.5 rounded-full shadow-lg disabled:opacity-50 transition-all"
            title="Download video"
          >
            {isDownloading ? (
              typeof progress === 'number' && progress >= 0 ? (
                <span className="text-[10px] font-semibold">{progress}%</span>
              ) : (
                <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></div>
              )
            ) : (
              <Download size={14} />
            )}
          </button>
        </div>
      </div>
    );
  }

  // For documents and other files, show file card
  return (
    <div className="bg-base-200 border border-base-300 rounded-lg p-3 mb-2 max-w-[280px]">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
          {getFileIcon(file.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-base-content/60">
            {getFileTypeLabel(file.type)} • {formatFileSize(file.size)}
          </p>
        </div>
        <button
          onClick={() => onDownload(file.url, file.name)}
          disabled={isDownloading}
          className="flex-shrink-0 btn btn-sm btn-ghost btn-circle disabled:opacity-50"
          title="Download file"
        >
          {isDownloading ? (
            typeof progress === 'number' && progress >= 0 ? (
              <span className="text-[10px] font-semibold">{progress}%</span>
            ) : (
              <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
            )
          ) : (
            <Download size={16} />
          )}
        </button>
      </div>
      {isDownloading && typeof progress === 'number' ? (
        <div className="mt-2">
          <div className="h-1 bg-base-300 rounded">
            <div className="h-1 bg-primary rounded" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] text-base-content/60 mt-1 text-right">Downloading {progress}%</p>
        </div>
      ) : null}
    </div>
  );
};

export default FileAttachment;