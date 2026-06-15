// Default QuestionCard. Day 2 polishes; Day 1 keeps it minimal so the engine boots.
// Demos can shadow this via WizardConfig.uiOverrides.QuestionCard.

import { useState } from 'react';
import type { Question } from '../types.js';

export function DefaultQuestionCard({
  question,
  onSubmit,
}: {
  question: Question;
  onSubmit: (answer: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <div className="flowgent-question-card">
      <p>{question.prompt}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your answer..."
      />
      <button
        type="button"
        onClick={() => {
          onSubmit(text);
          setText('');
        }}
      >
        Submit
      </button>
    </div>
  );
}
