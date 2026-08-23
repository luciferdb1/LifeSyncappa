const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/const handleInitiateCall =.*?};\n/s, 
`const handleInitiateCall = (donor: Donor, force: boolean = false) => {
    if (!currentUser) {
      setActiveView('auth');
      return;
    }
    if (!force) {
      if (donor.agreedToDonate && donor.convincedByUid && donor.convincedByUid !== currentUser.uid) {
        setCallWarning({ donor, callerName: donor.convincedByName || 'Another editor' });
        return;
      }
      if (donor.lastRefusalDate) {
        const refusalDate = new Date(donor.lastRefusalDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - refusalDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          setRefusalWarning({ donor, reason: donor.lastRefusalReason || 'No reason specified', date: donor.lastRefusalDate });
          return;
        }
      }
    }
    setActiveCall({ number: donor.phone, name: donor.name, donorId: donor.id, alreadyAgreed: !!donor.agreedToDonate });
    window.location.href = \`tel:\${donor.phone}\`;
  };
`);

fs.writeFileSync('App.tsx', code);
