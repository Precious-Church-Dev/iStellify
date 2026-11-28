'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

type GenderPreview = {
  matched: number;
  eligible: number;
  usable: number;
  conflicts: number;
  missingGender: number;
};

export default function RosterGenderImport({ onComplete }: { onComplete: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<{ file: File; preview: GenderPreview } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(file: File, apply: boolean) {
    setBusy(true);
    setError('');
    setNotice('');
    if (!apply) setSelection(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('mode', apply ? 'genderApply' : 'genderPreview');
      const response = await fetch('/api/import', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to read roster genders.');
      if (apply) {
        setSelection(null);
        setNotice(
          `Gender updated for ${result.updated} active member${result.updated === 1 ? '' : 's'}.`,
        );
        await onComplete();
      } else {
        setSelection({ file, preview: result });
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      if (input.current) input.current.value = '';
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Fill missing genders from the roster</h2>
      <p className="muted">
        Match the workbook by Church Number. Members who already saved a gender keep their
        selection.
      </p>
      <label className="upload-field">
        <Upload size={20} />
        {busy ? 'Reading workbook…' : 'Choose workbook for gender update'}
        <input
          ref={input}
          type="file"
          accept=".xlsx"
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void submit(file, false);
          }}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {selection && (
        <div className="spaced">
          <p>
            {selection.preview.eligible} of {selection.preview.matched} matched active members have
            a missing gender.
          </p>
          {selection.preview.usable > selection.preview.matched && (
            <p className="muted">
              {selection.preview.usable - selection.preview.matched} entries did not match an active
              member.
            </p>
          )}
          {(selection.preview.missingGender > 0 || selection.preview.conflicts > 0) && (
            <p className="muted">
              Skipped {selection.preview.missingGender} rows without a usable gender and{' '}
              {selection.preview.conflicts} conflicting Church Numbers.
            </p>
          )}
          <button
            type="button"
            className="button primary"
            disabled={busy || !selection.preview.eligible}
            onClick={() => {
              void submit(selection.file, true);
            }}
          >
            Apply gender update
          </button>
        </div>
      )}
    </section>
  );
}
