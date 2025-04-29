import React from "react";

const CardGeneratorForm = React.memo(({ form, setForm, disabled, subjects = [], topics = [], examBoards = [], examTypes = [] }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <form>
      <label>
        Subject:
        <select name="subject" value={form.subject} onChange={handleChange} disabled={disabled}>
          <option value="">Select Subject</option>
          {subjects.map((sub) => (
            <option key={sub} value={sub}>{sub}</option>
          ))}
        </select>
      </label>
      <label>
        Topic:
        <select name="topic" value={form.topic} onChange={handleChange} disabled={disabled || !form.subject}>
          <option value="">Select Topic</option>
          {topics
            .filter((t) => t.subject === form.subject)
            .map((t) => (
              <option key={t.id || t.topic} value={t.topic}>{t.topic}</option>
            ))}
        </select>
      </label>
      <label>
        Exam Board:
        <select name="examBoard" value={form.examBoard} onChange={handleChange} disabled={disabled}>
          <option value="">Select Board</option>
          {examBoards.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </label>
      <label>
        Exam Type:
        <select name="examType" value={form.examType} onChange={handleChange} disabled={disabled}>
          <option value="">Select Type</option>
          {examTypes.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>
      <label>
        Number of Cards:
        <input
          name="numCards"
          type="number"
          min="1"
          max="20"
          value={form.numCards}
          onChange={handleChange}
          disabled={disabled}
        />
      </label>
      <label>
        Question Type:
        <select name="questionType" value={form.questionType} onChange={handleChange} disabled={disabled}>
          <option value="multiple_choice">Multiple Choice</option>
          <option value="short_answer">Short Answer</option>
          <option value="essay">Essay Style</option>
          <option value="acronym">Acronym</option>
        </select>
      </label>
    </form>
  );
});

export default CardGeneratorForm; 