import React from "react";

const TriageResult = ({ result }) => {
  return (
    <div className="p-4 bg-white rounded shadow mt-4">
      <h2 className="text-xl font-bold mb-2">Triage Result</h2>
      {result ? (
        <p>{result}</p>
      ) : (
        <p>No result yet. Submit the form to see the triage outcome.</p>
      )}
    </div>
  );
};

export default TriageResult;
