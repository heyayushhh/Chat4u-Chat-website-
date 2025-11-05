import { useEffect, useState } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { Users, UserMinus, UserPlus, Crown, Camera, Download, Image as ImageIcon, Phone, Video, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { downloadFileWithProgress } from "../lib/utils";

const GroupInfo = ({ onBack }) => {
  const { selectedGroup, getGroupInfo, removeMember, addMembers, leaveGroup, updateGroupProfile, isUpdatingGroup, deleteGroup, messages, getGroupMessages, isMessagesLoading } = useGroupStore();
  const { authUser } = useAuthStore();
  const { users, sendContactRequest, setSelectedUser } = useChatStore();
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [pickIds, setPickIds] = useState([]);
  const [localAvatar, setLocalAvatar] = useState(null);
  const [localDesc, setLocalDesc] = useState("");
  const [resolvedUsers, setResolvedUsers] = useState({}); // { userId: { username, fullName, profilePic } }
  const [activeTab, setActiveTab] = useState("details");
  const [downloadingIds, setDownloadingIds] = useState(new Set());
  const [downloadProgress, setDownloadProgress] = useState({});
  const [calls, setCalls] = useState([]);
  const [isCallsLoading, setIsCallsLoading] = useState(false);
  const [callsError, setCallsError] = useState(null);
  const [mediaFilter, setMediaFilter] = useState("images");

  // Only fetch deep group info if you are a member to avoid 403 toasts
  useEffect(() => {
    if (!selectedGroup?._id) return;
    const isMember = (selectedGroup.members || [])
      .map((m) => String(m?._id || m))
      .includes(String(authUser?._id));
    if (isMember) {
      getGroupInfo(selectedGroup._id);
    }
  }, [selectedGroup?._id, selectedGroup?.members, authUser?._id, getGroupInfo]);

  // Fetch messages when opening Media tab
  useEffect(() => {
    if (!selectedGroup?._id || activeTab !== "media") return;
    const isMember = (selectedGroup.members || [])
      .map((m) => String(m?._id || m))
      .includes(String(authUser?._id));
    if (!isMember) return;
    if (!messages || messages.length === 0) {
      getGroupMessages(selectedGroup._id);
    }
  }, [activeTab, selectedGroup?._id, selectedGroup?.members, authUser?._id, messages?.length, getGroupMessages]);

  // Fetch group call records when opening Calls tab
  useEffect(() => {
    const fetchCalls = async () => {
      if (!selectedGroup?._id || activeTab !== "calls") return;
      // require membership
      const isMember = (selectedGroup.members || [])
        .map((m) => String(m?._id || m))
        .includes(String(authUser?._id));
      if (!isMember) return;
      setIsCallsLoading(true);
      setCallsError(null);
      try {
        const res = await axiosInstance.get(`/group-calls/${selectedGroup._id}`);
        setCalls(res.data || []);
      } catch (e) {
        setCallsError(e?.response?.data?.message || "Failed to load calls");
      } finally {
        setIsCallsLoading(false);
      }
    };
    fetchCalls();
  }, [activeTab, selectedGroup?._id, selectedGroup?.members, authUser?._id]);

  useEffect(() => {
    // Initialize local description from saved group data so it persists across views
    setLocalDesc(selectedGroup?.description || "");
  }, [selectedGroup?._id, selectedGroup?.description]);

  if (!selectedGroup) return null;
  const isAdmin = String(selectedGroup.adminId) === String(authUser?._id) || String(selectedGroup.adminId?._id) === String(authUser?._id);

  const members = selectedGroup.members || [];
  const memberIds = members.map((m) => (m ? m._id || m : null)).filter(Boolean);
  const memberIdSet = new Set(memberIds.map((id) => String(id)));
  // Only allow valid, non-ephemeral contacts with a real ObjectId
  const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(String(id || ""));
  const availableToAdd = (users || [])
    .filter((u) => !!u && isValidId(u._id) && !u.ephemeral)
    .filter((u) => !memberIdSet.has(String(u._id)));

  // Resolve usernames/pics for group members who aren't in contacts and appear as bare IDs
  useEffect(() => {
    const resolveMissing = async () => {
      try {
        const idsInGroup = members.map((m) => (m ? m._id || m : null)).filter(Boolean);
        const contactIds = new Set(users.map((u) => String(u._id)));
        const toResolve = idsInGroup.filter((id) => {
          const memberObj = members.find((m) => {
            const mid = m ? m._id || m : null;
            return String(mid || "") === String(id);
          });
          const hasUsernameInline = typeof memberObj === "object" && !!memberObj.username;
          const alreadyResolved = !!resolvedUsers[id];
          const isContact = contactIds.has(String(id));
          return !hasUsernameInline && !alreadyResolved && !isContact;
        });

        for (const id of toResolve) {
          try {
            const res = await axiosInstance.get(`/users/${id}`);
            const { username, fullName, profilePic } = res.data || {};
            setResolvedUsers((prev) => ({ ...prev, [id]: { username, fullName, profilePic } }));
          } catch (e) {
            // best-effort; ignore individual failures
          }
        }
      } catch (err) {
        // ignore batch resolve errors
      }
    };

    if (selectedGroup?._id) resolveMissing();
  }, [selectedGroup?._id, members, users]);

  const resolveUsername = async (userId) => {
    const cached = resolvedUsers[userId];
    if (cached?.username) return cached.username;
    try {
      const res = await axiosInstance.get(`/users/${userId}`);
      const { username, fullName, profilePic } = res.data || {};
      setResolvedUsers((prev) => ({ ...prev, [userId]: { username, fullName, profilePic } }));
      return username;
    } catch (err) {
      return null;
    }
  };

  const handleSendRequest = async (userId, maybeUsername) => {
    try {
      const uname = maybeUsername || (await resolveUsername(userId));
      if (!uname) {
        toast.error("Cannot resolve username for request");
        return;
      }
      await sendContactRequest(uname);
    } catch (e) {
      // sendContactRequest already toasts on error
    }
  };

  const handleOpenDM = async (userId, maybeUsername) => {
    try {
      const contact = users.find((u) => String(u._id) === String(userId));
      if (contact) {
        setSelectedUser(contact);
        onBack?.();
        return;
      }

      // Not a contact: build minimal user object with resolved info
      let username = maybeUsername || (await resolveUsername(userId));
      const resolved = resolvedUsers[userId] || {};
      const minimal = {
        _id: userId,
        username: username || resolved.username || "unknown",
        fullName: resolved.fullName || username || "Unknown",
        profilePic: resolved.profilePic || "/avatar.png",
      };
      setSelectedUser(minimal);
      onBack?.();
    } catch (e) {
      toast.error("Failed to open chat");
    }
  };

  return (
    <div className="flex-1 p-4 lg:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-zinc-400">Group</div>
        {onBack && (
          <button className="btn btn-ghost btn-sm" onClick={onBack} title="Back to chat">
            Back to Chat
          </button>
        )}
      </div>
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          className={`btn btn-xs ${activeTab === "details" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setActiveTab("details")}
        >
          Details
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
      <div className="border-b border-base-300 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={localAvatar || selectedGroup.avatar || "/avatar.png"}
              className="size-12 rounded-full object-cover border"
            />
            <label
              htmlFor="group-avatar-upload"
              className={`absolute -bottom-1 -right-1 bg-base-content p-1 rounded-full cursor-pointer ${isUpdatingGroup ? "pointer-events-none opacity-50" : ""}`}
              title="Upload avatar"
            >
              <Camera className="w-4 h-4 text-base-200" />
              <input
                id="group-avatar-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.type.startsWith("image/")) {
                    toast.error("Please select an image file");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onloadend = () => setLocalAvatar(reader.result);
                  reader.readAsDataURL(file);
                }}
                disabled={isUpdatingGroup}
              />
            </label>
          </div>
          <div>
            <div className="text-lg font-semibold">{selectedGroup.name}</div>
            <div className="text-sm text-zinc-400">Members: {members.length}</div>
          </div>
        </div>

        <div className="mt-3">
          <label className="text-sm text-zinc-400">Description</label>
          <textarea
            className="mt-1 textarea textarea-bordered w-full"
            rows={3}
            placeholder="Add a short description…"
            value={localDesc}
            onChange={(e) => setLocalDesc(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              className={`btn btn-primary btn-sm ${isUpdatingGroup ? "loading" : ""}`}
              onClick={async () => {
                await updateGroupProfile(selectedGroup._id, { avatar: localAvatar, description: localDesc.trim() });
                setLocalAvatar(null);
              }}
              disabled={isUpdatingGroup}
            >
              Save Changes
            </button>
            {(localAvatar || localDesc) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setLocalAvatar(null); setLocalDesc(selectedGroup.description || ""); }}>
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {activeTab === "details" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className="lg:col-span-2">
          <div className="mb-2 font-medium">Members</div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {members.map((m) => {
              const mid = m ? m._id || m : null;
              if (!mid) return null;
              const isMemberAdmin = String(mid) === String(selectedGroup.adminId?._id || selectedGroup.adminId);
              const isMe = String(mid) === String(authUser?._id);
              const isConnected = users.some((u) => String(u._id) === String(mid));
              const resolved = typeof m === "object" ? m : (resolvedUsers[mid] || {});
              const displayUsername = resolved.username || resolved.fullName || null;
              const displayPic = resolved.profilePic || (typeof m === "object" ? m.profilePic : null) || "/avatar.png";
              return (
                <div key={mid} className="flex items-center justify-between bg-base-200 p-2 rounded">
                  <div className="flex items-center gap-2">
                    <img src={displayPic} className="size-8 rounded-full" />
                    <div>
                      <div className="font-medium text-sm">@{displayUsername || String(mid).slice(0, 6)}</div>
                      {isMemberAdmin && (
                        <div className="text-xs text-primary inline-flex items-center gap-1"><Crown className="size-3" /> Admin</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && !isMemberAdmin && (
                      <button className="btn btn-xs" onClick={() => removeMember(selectedGroup._id, mid)}>
                        <UserMinus className="size-4" />
                        Remove
                      </button>
                    )}
                    {!isMe && (
                      <button
                        className="btn btn-xs"
                        title="Open chat"
                        onClick={() => handleOpenDM(mid, displayUsername)}
                      >
                        Message
                      </button>
                    )}
                    {!isMe && !isConnected && (
                      <button
                        className="btn btn-xs btn-primary"
                        title="Send contact request"
                        onClick={() => handleSendRequest(mid, displayUsername)}
                      >
                        Request
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>

          <div className="space-y-3">
          {isAdmin ? (
            <>
            <div className="bg-base-200 p-3 rounded">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium inline-flex items-center gap-2"><UserPlus className="size-4" /> Add members</div>
                <button className="btn btn-xs" onClick={() => setShowAddMembers((s) => !s)}>
                  {showAddMembers ? "Close" : "Pick"}
                </button>
              </div>
              {showAddMembers && (
                <div className="space-y-2">
                  <div className="text-xs text-zinc-400">Contacts not in group</div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {availableToAdd.map((u) => (
                      <label key={u._id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          checked={pickIds.includes(u._id)}
                          onChange={(e) => {
                            setPickIds((prev) => {
                              if (e.target.checked) return [...prev, u._id];
                              return prev.filter((id) => id !== u._id);
                            });
                          }}
                        />
                        <img src={u.profilePic || "/avatar.png"} className="size-5 rounded-full" />
                        <span className="truncate">@{u.username}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    className="btn btn-primary btn-sm w-full"
                    disabled={pickIds.length === 0}
                    onClick={async () => {
                      await addMembers(selectedGroup._id, pickIds);
                      setPickIds([]);
                      setShowAddMembers(false);
                    }}
                  >
                    Add Selected
                  </button>
                </div>
              )}
            </div>
            <div className="bg-base-200 p-3 rounded mt-3">
              <div className="text-sm mb-2">Danger zone</div>
              <button
                className="btn btn-error btn-sm w-full"
                onClick={async () => {
                  const ok = window.confirm("Delete this group permanently? This cannot be undone.");
                  if (!ok) return;
                  await deleteGroup(selectedGroup._id);
                  onBack?.();
                }}
              >
                Delete Group
              </button>
            </div>
            </>
          ) : (
            <div className="bg-base-200 p-3 rounded space-y-2">
              <div className="text-sm">You can leave this group</div>
              <button className="btn btn-error btn-sm w-full" onClick={() => leaveGroup(selectedGroup._id)}>
                Leave Group
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "media" && (
        <div className="mt-4">
          {/* Media filter */}
          {(() => {
            const items = messages || [];
            const imageItems = items.filter((m) => !!m.image);
            const videoItems = items.filter((m) => !!m.file && typeof m.file.type === 'string' && m.file.type.startsWith('video/'));
            const documentItems = items.filter((m) => !!m.file && (!m.file.type || (!m.file.type.startsWith('image/') && !m.file.type.startsWith('video/'))));
            return (
              <div className="mb-3 flex items-center gap-2">
                <button
                  className={`btn btn-xs ${mediaFilter === 'images' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMediaFilter('images')}
                >
                  <ImageIcon className="size-4 mr-1" /> Images ({imageItems.length})
                </button>
                <button
                  className={`btn btn-xs ${mediaFilter === 'videos' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMediaFilter('videos')}
                >
                  <Video className="size-4 mr-1" /> Videos ({videoItems.length})
                </button>
                <button
                  className={`btn btn-xs ${mediaFilter === 'documents' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMediaFilter('documents')}
                >
                  <FileText className="size-4 mr-1" /> Documents ({documentItems.length})
                </button>
              </div>
            );
          })()}
          <div className="mb-2 font-medium inline-flex items-center gap-2">
            {mediaFilter === 'images' && (<><ImageIcon className="size-4" /> Images</>)}
            {mediaFilter === 'videos' && (<><Video className="size-4" /> Videos</>)}
            {mediaFilter === 'documents' && (<><FileText className="size-4" /> Documents</>)}
          </div>
          {isMessagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-sm" />
            </div>
          ) : (() => {
            const isMember = (selectedGroup.members || [])
              .map((m) => String(m?._id || m))
              .includes(String(authUser?._id));
            if (!isMember) {
              return <div className="text-sm text-zinc-400">Join the group to view media.</div>;
            }
            const items = (messages || []).slice().reverse();
            const images = items.filter((m) => !!m.image);
            const videos = items.filter((m) => !!m.file && typeof m.file.type === 'string' && m.file.type.startsWith('video/'));
            const documents = items.filter((m) => !!m.file && (!m.file.type || (!m.file.type.startsWith('image/') && !m.file.type.startsWith('video/'))));

            const handleDownload = async (url, name, id) => {
              setDownloadingIds((prev) => new Set(prev).add(id));
              try {
                await downloadFileWithProgress(url, name, {
                  onProgress: (percent) => setDownloadProgress((p) => ({ ...p, [id]: percent })),
                });
              } finally {
                setDownloadingIds((prev) => {
                  const copy = new Set(prev);
                  copy.delete(id);
                  return copy;
                });
                setDownloadProgress((p) => {
                  const copy = { ...p };
                  delete copy[id];
                  return copy;
                });
              }
            };

            if (mediaFilter === 'images') {
              if (images.length === 0) return <div className="text-sm text-zinc-400">No images found in this group.</div>;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {images.map((m) => (
                    <div key={m._id} className="relative group">
                      <img src={m.image} alt="Group media" className="w-full h-auto rounded-md" />
                      <div className="absolute left-2 bottom-2 text-[11px] px-1.5 py-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition">
                        Received {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <button
                        className="absolute bottom-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-800 p-1.5 rounded-full shadow opacity-0 group-hover:opacity-100 transition"
                        onClick={() => handleDownload(m.image, `image-${m._id}.jpg`, m._id)}
                        title="Download"
                        disabled={downloadingIds.has(m._id)}
                      >
                        {downloadingIds.has(m._id) ? (
                          typeof downloadProgress[m._id] === 'number' ? (
                            <span className="text-[10px] font-semibold">{downloadProgress[m._id]}%</span>
                          ) : (
                            <div className="animate-spin w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full"></div>
                          )
                        ) : (
                          <Download size={16} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              );
            }

            if (mediaFilter === 'videos') {
              if (videos.length === 0) return <div className="text-sm text-zinc-400">No videos found in this group.</div>;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {videos.map((m) => (
                    <div key={m._id} className="relative group">
                      <video src={m.file.url} controls className="w-full rounded-md" preload="metadata" />
                      <div className="absolute left-2 bottom-2 text-[11px] px-1.5 py-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition">
                        Received {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <button
                        className="absolute bottom-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-800 p-1.5 rounded-full shadow opacity-0 group-hover:opacity-100 transition"
                        onClick={() => handleDownload(m.file.url, m.file.name || `video-${m._id}.mp4`, m._id)}
                        title="Download"
                        disabled={downloadingIds.has(m._id)}
                      >
                        {downloadingIds.has(m._id) ? (
                          typeof downloadProgress[m._id] === 'number' ? (
                            <span className="text-[10px] font-semibold">{downloadProgress[m._id]}%</span>
                          ) : (
                            <div className="animate-spin w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full"></div>
                          )
                        ) : (
                          <Download size={16} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              );
            }

            // documents
            if (documents.length === 0) return <div className="text-sm text-zinc-400">No documents found in this group.</div>;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {documents.map((m) => (
                  <div key={m._id} className="bg-base-200 border border-base-300 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={m.file.name}>{m.file.name || `file-${m._id}`}</p>
                        <p className="text-xs text-base-content/60 truncate">Received {new Date(m.createdAt).toLocaleString()}</p>
                      </div>
                      <button
                        className="flex-shrink-0 btn btn-sm btn-ghost btn-circle"
                        onClick={() => handleDownload(m.file.url, m.file.name || `file-${m._id}`, m._id)}
                        title="Download"
                        disabled={downloadingIds.has(m._id)}
                      >
                        {downloadingIds.has(m._id) ? (
                          typeof downloadProgress[m._id] === 'number' ? (
                            <span className="text-[10px] font-semibold">{downloadProgress[m._id]}%</span>
                          ) : (
                            <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                          )
                        ) : (
                          <Download size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === "calls" && (
        <div className="mt-4">
          <div className="mb-2 font-medium inline-flex items-center gap-2">
            <Phone className="size-4" /> Calls
          </div>
          {isCallsLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-sm" />
            </div>
          ) : callsError ? (
            <div className="text-error text-sm">{callsError}</div>
          ) : (() => {
            const isMember = (selectedGroup.members || [])
              .map((m) => String(m?._id || m))
              .includes(String(authUser?._id));
            if (!isMember) {
              return <div className="text-sm text-zinc-400">Join the group to view calls.</div>;
            }
            if (!calls || calls.length === 0) {
              return <div className="text-sm text-zinc-400">No calls found in this group.</div>;
            }
            return (
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
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default GroupInfo;