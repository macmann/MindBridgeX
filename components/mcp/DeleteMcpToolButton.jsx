'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteMcpToolButton({ serverId, toolId }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!serverId || !toolId) return;
    if (!window.confirm('Delete this tool?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/mcp-servers/${serverId}/tools?toolId=${toolId}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to delete tool');
      }
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button className="table-action" type="button" onClick={handleDelete} disabled={isDeleting}>
      {isDeleting ? 'Deleting…' : 'Delete'}
    </button>
  );
}
