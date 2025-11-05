import { useEffect, useState } from "react";
import { X, Download, Phone, Video, FileText } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import { downloadFileWithProgress } from "../lib/utils";
import { useChatStore } from "../store/useChatStore";

const UserProfileModal = ({ userId, isOpen, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [media, setMedia] = useState([]);
  const [videos, setVideos] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [downloadingIds, setDownloadingIds] = useState(new Set());
  const [mediaFilter, setMediaFilter] = useState("images"); // images | videos | documents
  const [calls, setCalls] = useState([]);
  const [isCallsLoading, setIsCallsLoading] = useState(false);
  const [callsError, setCallsError] = useState(null);
  const { users, removeContact, setSelectedUser, selectedUser } = useChatStore();

  const isContact = (users || []).some((u) => String(u._id) === String(userId));

  useEffect(() => {
    const fetchUser = async () => {
      if (!isOpen || !userId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await axiosInstance.get(`/users/${userId}`);
        setData(res.data);
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load user");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [isOpen, userId]);

  useEffect(() => {
    const fetchMedia = async () => {
      if (!isOpen || !userId || activeTab !== "media") return;
      setIsMediaLoading(true);
      setMediaError(null);
      try {
        const res = await axiosInstance.get(`/messages/${userId}`);
        const all = (res.data || []).slice().reverse(); // newest first
        const images = all.filter((m) => !!m.image);
        const vids = all.filter((m) => m.file?.type?.startsWith("video/") && m.file?.url);
        const docs = all.filter((m) => m.file && !m.file.type?.startsWith("image/") && !m.file.type?.startsWith("video/") && m.file?.url);
        setMedia(images);
        setVideos(vids);
        setDocuments(docs);
      } catch (e) {
        setMediaError(e?.response?.data?.message || "Failed to load media");
      } finally {
        setIsMediaLoading(false);
      }
    };
    fetchMedia();
  }, [isOpen, userId, activeTab]);

  useEffect(() => {
    const fetchCalls = async () => {
      if (!isOpen || !userId || activeTab !== "calls") return;
      setIsCallsLoading(true);
      setCallsError(null);
      try {
        const res = await axiosInstance.get(`/calls/${userId}`);
        setCalls(res.data || []);
      } catch (e) {
        setCallsError(e?.response?.data?.message || "Failed to load calls");
      } finally {
        setIsCallsLoading(false);
      }
    };
    fetchCalls();
  }, [isOpen, userId, activeTab]);

  const handleDownload = async (url, id, nameHint) => {
    try {
      setDownloadingIds((prev) => new Set(prev).add(id));
      await downloadFileWithProgress(url, nameHint || `file-${id}`);
    } finally {
      setDownloadingIds((prev) => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-xl shadow-lg p-0 w-[92%] max-w-md border border-base-300">
        <div className="flex items-center justify-between mb-4">
          <div className="px-6 pt-4">
            <h3 className="font-semibold">User Profile</h3>
          </div>
          <button className="btn btn-ghost btn-sm mr-2 mt-2" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        <div className="px-6 pb-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              className={`btn btn-xs ${activeTab === "profile" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveTab("profile")}
            >
              Profile
            </button>
            <button
              className={`btn btn-xs ${activeTab === "media" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveTab("media")}
            >
              Media
            </button>
            <button
              className={`btn btn-xs ${activeTab === "calls" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveTab("calls")}
            >
              Calls
            </button>
          </div>

          {activeTab === "profile" && (
            <div>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="loading loading-spinner loading-sm" />
                </div>
              ) : error ? (
                <div className="text-error text-sm">{error}</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="avatar">
                      <div className="w-12 h-12 rounded-full border">
                        <img src={data?.profilePic || "/avatar.png"} alt="avatar" />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">{data?.fullName}</div>
                      <div className="text-xs text-zinc-400">@{data?.username}</div>
                    </div>
                  </div>

                  {data?.description && (
                    <div>
                      <div className="text-sm text-zinc-400 mb-1">Description</div>
                      <p className="px-3 py-2 bg-base-200 rounded border text-sm whitespace-pre-line">
                        {data.description}
                      </p>
                    </div>
                  )}

                  {/* Danger zone: remove contact */}
                  {isContact && (
                    <div className="mt-4">
                      <div className="text-sm text-zinc-400 mb-1">Actions</div>
                      <button
                        className="btn btn-error btn-sm"
                        onClick={async () => {
                          await removeContact(userId);
                          if (selectedUser && String(selectedUser._id) === String(userId)) {
                            setSelectedUser(null);
                          }
                          onClose?.();
                        }}
                      >
                        Remove Contact
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "media" && (
            <div>
              {isMediaLoading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="loading loading-spinner loading-sm" />
                </div>
              ) : mediaError ? (
                <div className="text-error text-sm">{mediaError}</div>
              ) : (
                <div>
                  {/* Media filter buttons */}
                  <div className="flex gap-2 mb-3">
                    <button className={`btn btn-xs ${mediaFilter === "images" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMediaFilter("images")}>Images</button>
                    <button className={`btn btn-xs ${mediaFilter === "videos" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMediaFilter("videos")}>Videos</button>
                    <button className={`btn btn-xs ${mediaFilter === "documents" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMediaFilter("documents")}>Documents</button>
                  </div>

                  {mediaFilter === "images" && (
                    media.length === 0 ? (
                      <div className="text-sm text-zinc-400">No images found in this chat.</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {media.map((m) => {
                          const when = new Date(m.createdAt || Date.now()).toLocaleString();
                          return (
                            <div key={m._id} className="relative group">
                              <img src={m.image} alt="Chat image" className="w-full h-auto rounded-md" />
                              <div className="absolute left-2 bottom-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition">{when}</div>
                              <button
                                className="absolute bottom-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-800 p-1.5 rounded-full shadow opacity-0 group-hover:opacity-100 transition"
                                onClick={() => handleDownload(m.image, m._id, `image-${m._id}`)}
                                title="Download"
                                disabled={downloadingIds.has(m._id)}
                              >
                                {downloadingIds.has(m._id) ? (
                                  <div className="animate-spin w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full"></div>
                                ) : (
                                  <Download size={16} />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {mediaFilter === "videos" && (
                    videos.length === 0 ? (
                      <div className="text-sm text-zinc-400">No videos found in this chat.</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {videos.map((m) => {
                          const when = new Date(m.createdAt || Date.now()).toLocaleString();
                          const ext = (m.file?.name || "").split(".").pop()?.toUpperCase();
                          return (
                            <div key={m._id} className="relative group p-2 rounded-md border bg-base-200">
                              <div className="flex items-center gap-2">
                                <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center text-primary">🎥</div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm truncate">{m.file?.name || "Video"}</div>
                                  <div className="text-xs text-zinc-500">{ext || "VIDEO"} • {when}</div>
                                </div>
                              </div>
                              <button
                                className="absolute bottom-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-800 p-1.5 rounded-full shadow opacity-0 group-hover:opacity-100 transition"
                                onClick={() => handleDownload(m.file?.url, m._id, m.file?.name)}
                                title="Download"
                                disabled={downloadingIds.has(m._id)}
                              >
                                {downloadingIds.has(m._id) ? (
                                  <div className="animate-spin w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full"></div>
                                ) : (
                                  <Download size={16} />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {mediaFilter === "documents" && (
                    documents.length === 0 ? (
                      <div className="text-sm text-zinc-400">No documents found in this chat.</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {documents.map((m) => {
                          const when = new Date(m.createdAt || Date.now()).toLocaleString();
                          const ext = (m.file?.name || "").split(".").pop()?.toUpperCase();
                          return (
                            <div key={m._id} className="relative group p-2 rounded-md border bg-base-200">
                              <div className="flex items-center gap-2">
                                <div className="w-12 h-12 rounded bg-base-300 flex items-center justify-center text-base-content/80"><FileText className="size-6" /></div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm truncate">{m.file?.name || "Document"}</div>
                                  <div className="text-xs text-zinc-500">{ext || "FILE"} • {when}</div>
                                </div>
                              </div>
                              <button
                                className="absolute bottom-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-800 p-1.5 rounded-full shadow opacity-0 group-hover:opacity-100 transition"
                                onClick={() => handleDownload(m.file?.url, m._id, m.file?.name)}
                                title="Download"
                                disabled={downloadingIds.has(m._id)}
                              >
                                {downloadingIds.has(m._id) ? (
                                  <div className="animate-spin w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full"></div>
                                ) : (
                                  <Download size={16} />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "calls" && (
            <div>
              {isCallsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="loading loading-spinner loading-sm" />
                </div>
              ) : callsError ? (
                <div className="text-error text-sm">{callsError}</div>
              ) : calls.length === 0 ? (
                <div className="text-sm text-zinc-400">No calls found for this chat.</div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {calls.map((c) => {
                    const isMissed = c.status === "missed";
                    const started = c.startedAt || c.createdAt;
                    const when = new Date(started).toLocaleString();
                    const dur = c.durationSeconds ? `${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : null;
                    return (
                      <div key={c._id} className="flex items-center justify-between bg-base-200 p-2 rounded">
                        <div className="flex items-center gap-2">
                          {c.type === "video" ? (
                            <Video className={`size-4 ${isMissed ? "text-error" : "text-success"}`} />
                          ) : (
                            <Phone className={`size-4 ${isMissed ? "text-error" : "text-success"}`} />
                          )}
                          <div>
                            <div className="text-sm">{c.type === "video" ? "Video call" : "Audio call"}</div>
                            <div className="text-xs text-zinc-500">{when}{dur ? ` • ${dur}` : ""}</div>
                          </div>
                        </div>
                        <div className={`text-xs font-medium ${isMissed ? "text-error" : "text-success"}`}>
                          {isMissed ? "Missed" : "Completed"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;