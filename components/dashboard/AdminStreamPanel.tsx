"use client";

import { useState } from "react";
import StreamManageModal from "./StreamManageModal";

export default function AdminStreamPanel() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button className="btn-new-stream" onClick={() => setShowModal(true)}>
        + New Stream
      </button>

      {showModal && (
        <StreamManageModal mode="create" onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
