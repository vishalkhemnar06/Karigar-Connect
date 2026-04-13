import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API = `${BASE_URL}/api/groups`;

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

// 1. Create Group - Added `${API}/` for consistency
export const createGroupAPI = (data) =>
  axios.post(`${API}/`, data, { headers: getAuthHeader() });

// 2. Get My Groups - (Matches router.get("/my", ...))
export const getMyGroupsAPI = () =>
  axios.get(`${API}/my`, { headers: getAuthHeader() });

// 3. Add Member - FIXED: Changed "add-member" to "add" to match Backend Route
export const addMemberAPI = (groupId, userId) =>
  axios.put(
    `${API}/${groupId}/add`, 
    { userId },
    { headers: getAuthHeader() }
  );

// 4. Delete Group - (Matches router.delete("/:groupId", ...))
export const deleteGroupAPI = (groupId) =>
  axios.delete(`${API}/${groupId}`, { headers: getAuthHeader() });

export const leaveGroupAPI = (groupId) =>
  axios.put(`${API}/${groupId}/leave`, {}, { headers: getAuthHeader() });