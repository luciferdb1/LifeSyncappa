import re

with open('components/FollowUpManager.tsx', 'r') as f:
    code = f.read()

# Fix handleCallResult
old_logic = """        if (success) {
          updates.followUp3DayStatus = 'completed';
          updates.followUp3DayNextReminder = '';
        } else {
          updates.followUp3DayStatus = 'failed';
          const nextReminder = new Date();
          nextReminder.setHours(nextReminder.getHours() + 1); // Remind after 1 hour
          updates.followUp3DayNextReminder = nextReminder.toISOString();
        }
      } else {
        if (success) {
          updates.followUp7DayStatus = 'completed';
          updates.followUp7DayNextReminder = '';
        } else {
          updates.followUp7DayStatus = 'failed';
          const nextReminder = new Date();
          nextReminder.setHours(nextReminder.getHours() + 1); // Remind after 1 hour
          updates.followUp7DayNextReminder = nextReminder.toISOString();
        }"""

new_logic = """        if (success) {
          updates.followUp3DayStatus = 'completed';
          updates.followUp3DayNextReminder = '';
        } else {
          updates.followUp3DayStatus = 'failed';
          updates.followUp3DayNextReminder = ''; // Keep in notification
        }
      } else {
        if (success) {
          updates.followUp7DayStatus = 'completed';
          updates.followUp7DayNextReminder = '';
        } else {
          updates.followUp7DayStatus = 'failed';
          updates.followUp7DayNextReminder = ''; // Keep in notification
        }"""

code = code.replace(old_logic, new_logic)

# Fix modal text
old_modal = """              <h3 className="text-base font-bold text-slate-800 dark:text-white">Call Confirmation</h3>
              <p className="text-slate-600 dark:text-slate-400 mt-1 text-xs">
                Were you able to contact <strong>{selectedDonor.donor.name}</strong> ({selectedDonor.donor.phone})?
              </p>
            </div>
            
            <div className="p-4 space-y-2 bg-white dark:bg-slate-900">
              <button
                onClick={() => handleCallResult(true)}
                disabled={actionLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2 text-xs"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Yes, talked
              </button>
              
              <button
                onClick={() => handleCallResult(false)}
                disabled={actionLoading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-sm shadow-amber-200 dark:shadow-none transition-all flex items-center justify-center gap-2 text-xs"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
                No, remind me after 1 hour
              </button>"""

new_modal = """              <h3 className="text-base font-bold text-slate-800 dark:text-white">Communication Status</h3>
              <p className="text-slate-600 dark:text-slate-400 mt-1 text-xs">
                Was the communication with <strong>{selectedDonor.donor.name}</strong> successful?
              </p>
            </div>
            
            <div className="p-4 space-y-2 bg-white dark:bg-slate-900">
              <button
                onClick={() => handleCallResult(true)}
                disabled={actionLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2 text-xs"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Yes, successful
              </button>
              
              <button
                onClick={() => handleCallResult(false)}
                disabled={actionLoading}
                className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold shadow-sm shadow-rose-200 dark:shadow-none transition-all flex items-center justify-center gap-2 text-xs"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                No, did not reach
              </button>"""

code = code.replace(old_modal, new_modal)

with open('components/FollowUpManager.tsx', 'w') as f:
    f.write(code)
