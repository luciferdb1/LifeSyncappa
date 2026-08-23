import re

with open('App.tsx', 'r') as f:
    code = f.read()

old_str = """    setActiveCall({ number: donor.phone, name: donor.name, donorId: donor.id, alreadyAgreed: !!donor.agreedToDonate });
    window.location.href = `tel:${donor.phone}`;
  };"""

new_str = """    // @ts-ignore
    if (window.Android && window.Android.makeSipCall) {
      const callerUid = currentUser.uid;
      const callerName = userProfile?.displayName || currentUser.displayName || 'Unknown User';
      // @ts-ignore
      window.Android.makeSipCall(donor.phone, donor.name, callerUid, callerName);
      setActiveCall({ number: donor.phone, name: donor.name, donorId: donor.id, alreadyAgreed: !!donor.agreedToDonate });
    } else {
      setCustomAlert("SIP calling is only supported from the Android app. Please use the app.");
    }
  };"""

code = code.replace(old_str, new_str)

with open('App.tsx', 'w') as f:
    f.write(code)
