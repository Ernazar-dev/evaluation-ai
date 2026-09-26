// Individual assignments are never part of another student's audience.
export const recipientFilter = (studentId) => ({
  OR: [{ studentId: null }, { studentId }],
});

export function isAssignmentRecipient(assignment, studentId) {
  return assignment.studentId == null || assignment.studentId === studentId;
}
