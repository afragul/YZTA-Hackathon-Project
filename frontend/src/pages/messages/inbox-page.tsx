import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hackathon scope: there's only one channel right now (WhatsApp). The
 * "Inbox" entry in the sidebar redirects to it. When email/SMS land,
 * this page can grow into a unified inbox.
 */
export function InboxPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/messages/whatsapp', { replace: true });
  }, [navigate]);
  return null;
}
