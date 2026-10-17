import SchoolSelect from './SchoolSelect'

const emptyStudent = () => ({
  fullName: '',
  gradeLevel: '',
  schoolName: '',
  schoolLatitude: '',
  schoolLongitude: '',
})

export default function ChildrenEditor({ students, onChange, token, disabled = false, error = '' }) {
  const updateStudent = (index, updates) => {
    onChange(students.map((student, studentIndex) => (
      studentIndex === index ? { ...student, ...updates } : student
    )))
  }

  return (
    <div className="space-y-5">
      {students.map((student, index) => (
        <fieldset key={index} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <legend className="px-1 text-sm font-semibold text-gray-800">
            Child {index + 1}
          </legend>
          <div className="parent-settings__grid">
            <div className="parent-settings__field">
              <label htmlFor={`child-${index}-name`}>
                Student name <span aria-hidden="true">*</span>
              </label>
              <input
                id={`child-${index}-name`}
                type="text"
                value={student.fullName}
                onChange={(event) => updateStudent(index, { fullName: event.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="parent-settings__field">
              <label htmlFor={`child-${index}-grade`}>
                Grade/Section <span aria-hidden="true">*</span>
              </label>
              <input
                id={`child-${index}-grade`}
                type="text"
                placeholder="e.g. Grade 5 - Section A"
                value={student.gradeLevel}
                onChange={(event) => updateStudent(index, { gradeLevel: event.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="parent-settings__field">
              <SchoolSelect
                value={student.schoolName}
                latitude={student.schoolLatitude}
                longitude={student.schoolLongitude}
                token={token}
                onChange={(school) => updateStudent(index, {
                  schoolName: school?.name || '',
                  schoolLatitude: school?.latitude ?? '',
                  schoolLongitude: school?.longitude ?? '',
                })}
                disabled={disabled}
              />
            </div>
          </div>
          {students.length > 1 && (
            <button
              type="button"
              className="text-sm font-medium text-red-700 hover:underline"
              onClick={() => onChange(students.filter((_, studentIndex) => studentIndex !== index))}
              disabled={disabled}
            >
              Remove child
            </button>
          )}
        </fieldset>
      ))}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {students.length < 5 && (
        <button
          type="button"
          className="text-sm font-medium text-blue-700 hover:underline"
          onClick={() => onChange([...students, emptyStudent()])}
          disabled={disabled}
        >
          Add another child
        </button>
      )}
    </div>
  )
}
