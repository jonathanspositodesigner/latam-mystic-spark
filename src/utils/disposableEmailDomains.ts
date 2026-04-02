// Known disposable email domains - block these from signing up
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'temp-mail.de',
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.de', 'guerrillamail.biz',
  'guerrillamailblock.com', 'grr.la', 'sharklasers.com', 'pokemail.net', 'spam4.me',
  'yopmail.com', 'yopmail.fr', 'yopmail.net', 'yopmail.gq',
  'mailinator.com', 'mailinator.net', 'mailinator.org', 'mailinator2.com',
  'throwaway.email', 'throwaway.me',
  '10minutemail.com', '10minutemail.net', '10minutemail.org',
  'dispostable.com', 'mailnesia.com', 'maildrop.cc', 'mailcatch.com',
  'mailnull.com', 'mailsac.com', 'mailslurp.com',
  'mohmal.com', 'burnermail.io',
  'trashmail.com', 'trashmail.org', 'trashmail.net', 'trashmail.me', 'trash-mail.com',
  'fakeinbox.com', 'fakemail.net',
  'getairmail.com', 'getnada.com',
  'tempmailo.com', 'tempmailer.com',
  'spambox.us', 'spamfree24.org', 'spamgourmet.com',
  'emailondeck.com', 'emailfake.com',
  'disposable.email', 'discardmail.com', 'dropmail.me',
  'meltmail.com', 'mintemail.com', 'mytrashmail.com',
  'receiveee.com', 'selfdestructingmail.com',
  'tmail.ws', 'tmailinator.com',
  'teleworm.us', 'rhyta.com', 'armyspy.com', 'dayrep.com',
  'einrot.com', 'fleckens.hu', 'cuvox.de', 'gustr.com', 'jourrapide.com',
  'superrito.com', 'nada.email', 'nada.ltd',
  'inboxkitten.com', 'incognitomail.com', 'incognitomail.org',
  'spambob.com', 'spambog.com', 'spamcannon.com', 'spamcero.com',
  'spamcon.org', 'spamcowboy.com', 'spamday.com', 'spamex.com',
  'spamhereplease.com', 'spamhole.com', 'spaml.com',
  'spammotel.com', 'spamobox.com', 'spamoff.de', 'spamslicer.com',
  'spamspot.com', 'spamstack.net', 'spamtrail.com',
  'wegwerfemail.com', 'wegwerfemail.de', 'wegwerfmail.de', 'wegwerfmail.net',
  'zehnminutenmail.de', 'ephemail.net', 'devnullmail.com',
  'mailforspam.com', 'thisisnotmyrealemail.com', 'willselfdestruct.com',
  'emailspam.cf', 'emailspam.ga', 'emailspam.gq', 'emailspam.ml', 'emailspam.tk',
  'mailjunk.cf', 'mailjunk.ga', 'mailjunk.gq', 'mailjunk.ml', 'mailjunk.tk',
  'mailfree.ga', 'mailfree.gq', 'mailfree.ml',
  'one-time.email', 'oneoffemail.com',
  'harakirimail.com', 'haltospam.com',
  'killmail.com', 'killmail.net',
  'jetable.com', 'jetable.org',
  'filzmail.com', 'lookugly.com',
  'mailtemp.info', 'mailtemp.net',
  'nomail.xl.cx', 'nospam.ze.tc', 'nospamfor.us',
  'pjjkp.com', 'plexolan.de', 'proxymail.eu',
  'putthisinyouremail.com', 'saynotospams.com',
  'shortmail.net', 'slipry.net', 'sogetthis.com',
]);

const SUSPICIOUS_PATTERNS = [
  /tempmail/i, /temp-mail/i, /throwaway/i, /disposable/i,
  /10minute/i, /10min/i, /minutemail/i,
  /fakemail/i, /fakeinbox/i, /trashmail/i, /trash-mail/i,
  /spammail/i, /guerrillamail/i, /mailinator/i, /yopmail/i,
  /wegwerf/i, /temporarymail/i, /tempinbox/i,
  /burnermail/i, /nospam/i, /spamfree/i,
  /mailtemp/i, /junkmail/i, /discard/i,
];

/**
 * Check if an email uses a known disposable/temporary domain.
 * Returns true if the email should be blocked.
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;

  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return false;

  if (DISPOSABLE_DOMAINS.has(domain)) return true;

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(domain)) return true;
  }

  return false;
}
