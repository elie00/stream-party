import { useState, useCallback } from 'react';
import type { Role, Permission } from '@stream-party/shared';

const ALL_PERMISSIONS: { key: Permission; label: string }[] = [
  { key: 'admin', label: 'Administrator' },
  { key: 'manage_server', label: 'Manage Server' },
  { key: 'manage_channels', label: 'Manage Channels' },
  { key: 'manage_roles', label: 'Manage Roles' },
  { key: 'manage_messages', label: 'Manage Messages' },
  { key: 'kick_members', label: 'Kick Members' },
  { key: 'ban_members', label: 'Ban Members' },
  { key: 'mute_members', label: 'Mute Members' },
  { key: 'view_audit_log', label: 'View Audit Log' },
];

interface RoleManagerProps {
  roles: Role[];
  onCreateRole: (name: string, color: string, permissions: Permission[]) => void;
  onUpdateRole: (roleId: number, data: { name?: string; color?: string; permissions?: Permission[] }) => void;
  onDeleteRole: (roleId: number) => void;
}

export function RoleManager({ roles, onCreateRole, onUpdateRole, onDeleteRole }: RoleManagerProps) {
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="p-3 space-y-3">
      {/* Create button */}
      <button
        onClick={() => {
          setIsCreating(true);
          setEditingRole(null);
        }}
        className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
      >
        + Create Role
      </button>

      {/* Create form */}
      {isCreating && (
        <RoleForm
          onSave={(name, color, permissions) => {
            onCreateRole(name, color, permissions);
            setIsCreating(false);
          }}
          onCancel={() => setIsCreating(false)}
        />
      )}

      {/* Role list */}
      {roles
        .sort((a, b) => a.position - b.position)
        .map((role) => (
          <div key={role.id}>
            {editingRole?.id === role.id ? (
              <RoleForm
                initial={role}
                onSave={(name, color, permissions) => {
                  onUpdateRole(role.id, { name, color, permissions });
                  setEditingRole(null);
                }}
                onCancel={() => setEditingRole(null)}
              />
            ) : (
              <RoleItem
                role={role}
                onEdit={() => {
                  setEditingRole(role);
                  setIsCreating(false);
                }}
                onDelete={() => onDeleteRole(role.id)}
              />
            )}
          </div>
        ))}

      {roles.length === 0 && !isCreating && (
        <p className="text-sm text-[#808080] text-center py-4">No custom roles</p>
      )}
    </div>
  );
}

function RoleItem({
  role,
  onEdit,
  onDelete,
}: {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-[#252525] rounded-lg p-3 flex items-center justify-between group">
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: role.color || '#808080' }}
        />
        <div>
          <p className="text-sm text-white font-medium">{role.name}</p>
          <p className="text-xs text-[#606060]">
            {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
            {role.isDefault && ' (default)'}
          </p>
        </div>
      </div>
      {!role.isDefault && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="px-2 py-1 text-xs text-[#a0a0a0] hover:text-white bg-[#333] rounded transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-1 text-xs text-red-400 hover:text-red-300 bg-[#333] rounded transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function RoleForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Role;
  onSave: (name: string, color: string, permissions: Permission[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#3b82f6');
  const [permissions, setPermissions] = useState<Permission[]>(initial?.permissions ?? []);

  const togglePermission = useCallback((perm: Permission) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), color, permissions);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#252525] rounded-lg p-3 space-y-3">
      {/* Name */}
      <div>
        <label className="text-xs text-[#808080] block mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="Role name"
          className="w-full bg-[#1a1a1a] border border-[#444] rounded px-2 py-1.5 text-sm text-white placeholder-[#606060] focus:outline-none focus:border-blue-500"
          autoFocus
        />
      </div>

      {/* Color */}
      <div>
        <label className="text-xs text-[#808080] block mb-1">Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <span className="text-xs text-[#a0a0a0]">{color}</span>
        </div>
      </div>

      {/* Permissions */}
      <div>
        <label className="text-xs text-[#808080] block mb-1">Permissions</label>
        <div className="space-y-1">
          {ALL_PERMISSIONS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={permissions.includes(key)}
                onChange={() => togglePermission(key)}
                className="rounded border-[#444] bg-[#1a1a1a] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-[#c0c0c0]">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {initial ? 'Save' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs bg-[#333] text-[#a0a0a0] rounded hover:bg-[#3a3a3a] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
