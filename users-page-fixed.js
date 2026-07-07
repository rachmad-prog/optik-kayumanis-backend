"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../lib/api";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "CUSTOMER",
};

export default function AdminUsersPage() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function loadUsers() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    api
      .get(`/admin/users${params.toString() ? `?${params}` : ""}`, token)
      .then((data) => setUsers(data.items))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (token) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEdit(u) {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone || "",
      password: "",
      role: u.role,
    });
    setError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editingId) {
        const payload = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
        };
        if (form.password) payload.password = form.password;
        await api.put(`/admin/users/${editingId}`, payload, token);
      } else {
        await api.post("/admin/users", form, token);
      }
      setShowModal(false);
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u) {
    if (!confirm(`Hapus user "${u.name}"?`)) return;
    try {
      await api.del(`/admin/users/${u.id}`, token);
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-semibold text-bark-700">
          Kelola User
        </h1>
        <button
          onClick={openCreate}
          className="bg-cinnamon-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-cinnamon-600">
          + Tambah User
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadUsers()}
          placeholder="Cari nama atau email..."
          className="border border-sand rounded-full px-4 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-sand rounded-full px-4 py-2 text-sm">
          <option value="">Semua Role</option>
          <option value="CUSTOMER">Customer</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button
          onClick={loadUsers}
          className="border border-sand rounded-full px-4 py-2 text-sm text-bark-500 hover:bg-sand">
          Cari
        </button>
      </div>

      {loading ? (
        <p className="text-bark-300 text-sm">Memuat user...</p>
      ) : (
        <div className="bg-white border border-sand rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/60 text-bark-500 text-left">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Telepon</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Pesanan</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter(
                  (u) =>
                    u.role !== "DIREKTUR" && u.email !== "direktur@gmail.com",
                ) // 🛡️ Sembunyikan akun Direktur Utama
                .map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 text-sm font-medium text-bark-700">
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-bark-500">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-bark-500">
                      {u.phone || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          u.role === "ADMIN"
                            ? "bg-sand text-cinnamon-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-bark-500">
                      {u.ordersCount || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-right space-x-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-cinnamon-600 hover:underline">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-red-500 hover:underline">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-bark-300">
                    Tidak ada user ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="font-display text-lg font-semibold text-bark-700 mb-4">
              {editingId ? "Edit User" : "Tambah User"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-bark-500 mb-1 block">Nama</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-bark-500 mb-1 block">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-bark-500 mb-1 block">
                  Telepon
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-bark-500 mb-1 block">
                  {editingId
                    ? "Password baru (kosongkan jika tidak diubah)"
                    : "Password"}
                </label>
                <input
                  required={!editingId}
                  type="password"
                  minLength={6}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-bark-500 mb-1 block">Role</label>
                <select
                  value={form.role}
                  disabled={editingId === currentUser?.id}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm disabled:opacity-50">
                  <option value="CUSTOMER">Customer</option>
                  <option value="ADMIN">Admin (Karyawan)</option>
                </select>
                <p className="text-[11px] text-bark-300 mt-1">
                  Pilih "Admin" untuk memberi akses karyawan ke panel admin.
                </p>
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-full text-sm text-bark-500 hover:bg-sand">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-cinnamon-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-cinnamon-600 disabled:opacity-50">
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
