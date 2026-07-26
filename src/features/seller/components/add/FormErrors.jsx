import React from "react";

const FormErrors = ({ uploadError, dbError }) => {
  if (!uploadError && !dbError) return null;

  return (
    <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-xs font-semibold text-rose-600 space-y-1">
      {uploadError && <p>⚠️ Storage: {uploadError}</p>}
      {dbError && <p>⚠️ Firestore: {dbError?.message || dbError}</p>}
    </div>
  );
};

export default React.memo(FormErrors);
