import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

const cloudinaryCloudName = 'oux3y1xq';
const cloudinaryUploadPreset = 'mustang_pantry_uploads';
const allowedDomain = '@calpoly.edu';
// Keep this list identical to the organizer list in firestore.rules.
const pantryStaffEmails = new Set([
  'pantry-staff@calpoly.edu'
]);
const listingsCollection = () => collection(window.db, 'listings');

const authPanel = document.querySelector('#authPanel');
const authForm = document.querySelector('#authForm');
const authStatus = document.querySelector('#authStatus');
const verificationPanel = document.querySelector('#verificationPanel');
const verificationEmail = document.querySelector('#verificationEmail');
const verificationStatus = document.querySelector('#verificationStatus');
const checkVerificationButton = document.querySelector('#checkVerification');
const resendVerificationButton = document.querySelector('#resendVerification');
const createAccountButton = document.querySelector('#createAccount');
const signOutButton = document.querySelector('#signOut');
const userEmail = document.querySelector('#userEmail');
const appShell = document.querySelector('#top');
const roleTabs = document.querySelectorAll('.role-tab');
const form = document.querySelector('#listingForm');
const feedView = document.querySelector('.feed-view');
const listingFeed = document.querySelector('#listingFeed');
const emptyState = document.querySelector('#emptyState');
const listingCount = document.querySelector('#listingCount');
const workspaceHeading = document.querySelector('.workspace .section-heading');
const formStatus = document.querySelector('#formStatus');
const photoFile = document.querySelector('#photoFile');
const staffTools = document.querySelector('.staff-tools');
const inventorySortControls = document.querySelector('.inventory-sort');
const staffInventory = document.querySelector('#staffInventory');
const copyYesterdayButton = document.querySelector('#copyYesterday');
const inventorySortButtons = document.querySelectorAll('[data-inventory-sort]');
const feedSortButtons = document.querySelectorAll('[data-feed-sort]');
let liveListings = [];
const stockLevelQuantities = { low: 1, moderate: 5, high: 10 };
let inventorySort = 'alphabetical';
let feedSort = 'alphabetical';

function localDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function listingDate(listing) {
  return listing.stockDate || localDateKey(listing.postedAt);
}

function todayListings() {
  return liveListings.filter(listing => listingDate(listing) === localDateKey());
}

function listingQuantity(listing) {
  return Number.isFinite(Number(listing.quantity)) ? Math.max(0, Number(listing.quantity)) : 1;
}

function listingStockLevel(listing) {
  if (listing.stockLevel && stockLevelQuantities[listing.stockLevel]) return listing.stockLevel;
  const quantity = listingQuantity(listing);
  return quantity <= 2 ? 'low' : quantity <= 5 ? 'moderate' : 'high';
}

function stockLevelLabel(listing) {
  return `${listingStockLevel(listing).replace(/^./, character => character.toUpperCase())} stock`;
}

async function uploadPhoto(photo) {
  if (!photo) return '';
  if (photo.size > 5 * 1024 * 1024) throw new Error('photo-too-large');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) throw new Error('photo-type-not-supported');
  const formData = new FormData();
  formData.append('file', photo);
  formData.append('upload_preset', cloudinaryUploadPreset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error('cloudinary-upload-failed');
  const result = await response.json();
  return result.secure_url;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function renderFeed(listings = liveListings) {
  const stockOrder = { low: 1, moderate: 2, high: 3 };
  const sortedListings = [...listings]
    .filter(listing => listingDate(listing) === localDateKey() && listingQuantity(listing) > 0)
    .sort((first, second) => {
      if (feedSort === 'high') return stockOrder[listingStockLevel(second)] - stockOrder[listingStockLevel(first)] || first.foodType.localeCompare(second.foodType);
      if (feedSort === 'low') return stockOrder[listingStockLevel(first)] - stockOrder[listingStockLevel(second)] || first.foodType.localeCompare(second.foodType);
      return first.foodType.localeCompare(second.foodType);
    });
  const canManageStock = pantryStaffEmails.has(window.auth.currentUser?.email?.toLowerCase());
  listingCount.textContent = sortedListings.length;
  listingFeed.innerHTML = sortedListings.map(listing => `
    <article class="listing-card">
      <div class="listing-main">
        <h3>${escapeHtml(listing.foodType)}</h3>
        <div class="listing-meta"><span class="category">${escapeHtml(listing.category || 'Pantry item')}</span><span class="updated">${stockLevelLabel(listing)}</span></div>
        ${listing.notes ? `<p class="listing-notes">${escapeHtml(listing.notes)}</p>` : ''}
      </div>
      <div class="listing-photo-slot">${listing.photoUrl ? `<img class="listing-photo" src="${escapeHtml(listing.photoUrl)}" alt="${escapeHtml(listing.foodType)}" loading="lazy" />` : ''}</div>
      ${canManageStock ? `<button class="remove-button" type="button" data-remove-id="${listing.id}" aria-label="Remove ${escapeHtml(listing.foodType)} from today\'s stock" title="Remove item"><span class="trash-icon" aria-hidden="true"></span><span class="remove-label">Remove item</span></button>` : ''}
    </article>`).join('');
  emptyState.classList.toggle('hidden', sortedListings.length > 0);
}

function renderStaffInventory() {
  const stockOrder = { low: 1, moderate: 2, high: 3 };
  const sortedListings = todayListings().sort((first, second) => {
    if (inventorySort === 'high') return stockOrder[listingStockLevel(second)] - stockOrder[listingStockLevel(first)] || first.foodType.localeCompare(second.foodType);
    if (inventorySort === 'low') return stockOrder[listingStockLevel(first)] - stockOrder[listingStockLevel(second)] || first.foodType.localeCompare(second.foodType);
    return first.foodType.localeCompare(second.foodType);
  });
  staffInventory.innerHTML = sortedListings.length ? sortedListings.map(listing => `
    <article class="staff-stock-row">
      <div><strong>${escapeHtml(listing.foodType)}</strong><span>${escapeHtml(listing.category || 'Pantry item')}</span></div>
      <div class="quantity-control" aria-label="Adjust ${escapeHtml(listing.foodType)} quantity">
        <select class="stock-level-input" data-stock-level-input data-listing-id="${listing.id}" aria-label="${escapeHtml(listing.foodType)} stock level">
          <option value="low" ${listingStockLevel(listing) === 'low' ? 'selected' : ''}>Low stock</option>
          <option value="moderate" ${listingStockLevel(listing) === 'moderate' ? 'selected' : ''}>Moderate stock</option>
          <option value="high" ${listingStockLevel(listing) === 'high' ? 'selected' : ''}>High stock</option>
        </select>
      </div>
    </article>`).join('') : '<p class="inventory-empty">Nothing on today\'s list yet. Copy yesterday\'s list or add a new item below.</p>';
}

function setRole(role) {
  if (role === 'staff' && !pantryStaffEmails.has(window.auth.currentUser?.email?.toLowerCase())) {
    role = 'student';
  }
  const isStudent = role === 'student';
  roleTabs.forEach(tab => {
    const active = tab.dataset.role === role;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active);
  });
  form.classList.toggle('hidden', isStudent);
  staffTools.classList.toggle('hidden', isStudent);
  inventorySortControls.classList.toggle('hidden', isStudent);
  staffInventory.classList.toggle('hidden', isStudent);
  feedView.classList.toggle('hidden', !isStudent);
  workspaceHeading.classList.toggle('hidden', isStudent);
  if (isStudent) renderFeed();
  else renderStaffInventory();
}

function showFormStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle('error', isError);
}

function subscribeToListings() {
  const listingsQuery = query(listingsCollection(), where('status', '==', 'available'));
  onSnapshot(listingsQuery, snapshot => {
    liveListings = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (document.querySelector('[data-role="student"]')?.getAttribute('aria-selected') === 'true') renderFeed();
    else renderStaffInventory();
  }, error => console.error('Unable to read live listings:', error));
}

roleTabs.forEach(tab => tab.addEventListener('click', () => setRole(tab.dataset.role)));

inventorySortButtons.forEach(button => button.addEventListener('click', () => {
  inventorySort = button.dataset.inventorySort;
  inventorySortButtons.forEach(sortButton => sortButton.classList.toggle('active', sortButton === button));
  renderStaffInventory();
}));

feedSortButtons.forEach(button => button.addEventListener('click', () => {
  feedSort = button.dataset.feedSort;
  feedSortButtons.forEach(sortButton => sortButton.classList.toggle('active', sortButton === button));
  renderFeed();
}));

function authErrorMessage(error) {
  const messages = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'That account already exists. Sign in instead.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/invalid-email': 'Enter a valid @calpoly.edu email address.',
    'auth/operation-not-allowed': 'Email/password sign-in is disabled in Firebase Authentication.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/quota-exceeded': 'Firebase email delivery is temporarily limited. Try again later.',
    'auth/network-request-failed': 'Network request failed. Check your internet connection and try again.',
    'auth/invalid-api-key': 'The Firebase API key is invalid. Check the Firebase configuration in index.html.'
  };
  return messages[error.code] || `Firebase rejected the request (${error.code || 'unknown error'}).`;
}

function verificationEmailMessage(error) {
  const messages = {
    'auth/too-many-requests': 'Too many emails were requested. Wait a few minutes before trying again.',
    'auth/quota-exceeded': 'Firebase email delivery is temporarily limited. Try again later.',
    'auth/operation-not-allowed': 'Email/password authentication is disabled in Firebase.',
    'auth/unauthorized-continue-uri': 'This site must be added to Firebase Authentication’s Authorized domains before verification emails can be sent.',
    'auth/invalid-continue-uri': 'The verification return link is not configured correctly in Firebase Authentication.'
  };
  return messages[error.code] || 'Firebase could not send the verification email. Check Authentication email settings.';
}

function showVerificationMessage(message, isError = false) {
  verificationStatus.textContent = message;
  verificationStatus.classList.toggle('error', isError);
}

async function sendVerificationEmail(user, successMessage) {
  if (!user) throw new Error('auth/no-current-user');
  await sendEmailVerification(user);
  verificationEmail.textContent = user.email;
  showVerificationMessage(successMessage);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  showFormStatus("Adding today's stock...");
  const data = new FormData(form);
  try {
    const stockLevel = data.get('stockLevel');
    if (!stockLevelQuantities[stockLevel]) throw new Error('invalid-stock-level');
    const quantity = stockLevelQuantities[stockLevel];
    let photoUrl = '';
    if (photoFile.files[0]) {
      showFormStatus('Uploading photo...');
      photoUrl = await uploadPhoto(photoFile.files[0]);
    }
    const listing = { foodType: data.get('foodType'), category: data.get('category'), photoUrl, notes: data.get('notes'), postedAt: Date.now(), stockDate: localDateKey(), stockLevel, quantity, status: 'available', postedBy: window.auth.currentUser.email };
    const createdListing = await addDoc(listingsCollection(), listing);
    liveListings = [{ id: createdListing.id, ...listing }, ...liveListings.filter(item => item.id !== createdListing.id)];
    form.reset();
    showFormStatus('Stock added. Opening the student view...');
    setRole('student');
  } catch (error) {
    console.error('Unable to post listing:', error);
    const messages = { 'invalid-stock-level': 'Choose low, moderate, or high stock.', 'photo-too-large': 'Photo is too large. Choose an image under 5 MB.', 'photo-type-not-supported': 'Choose a JPG, PNG, or WEBP image.', 'cloudinary-upload-failed': 'Cloudinary rejected the photo. Check the upload preset name.', 'permission-denied': 'Your account is not authorized to update pantry stock.' };
    showFormStatus(messages[error.code] || messages[error.message] || 'The item could not be posted. Check Cloudinary and Firestore rules.', true);
  }
});

staffInventory.addEventListener('change', async event => {
  const input = event.target.closest('[data-stock-level-input]');
  if (!input) return;
  const listing = liveListings.find(item => item.id === input.dataset.listingId);
  if (!listing) return;
  const nextStockLevel = input.value;
  const nextQuantity = stockLevelQuantities[nextStockLevel];
  if (!nextQuantity) return;
  input.disabled = true;
  try {
    await updateDoc(doc(window.db, 'listings', listing.id), { stockLevel: nextStockLevel, quantity: nextQuantity });
    liveListings = liveListings.map(item => item.id === listing.id ? { ...item, stockLevel: nextStockLevel, quantity: nextQuantity } : item);
    renderStaffInventory();
  } catch (error) {
    console.error('Unable to update listing quantity:', error);
    showFormStatus('The quantity could not be updated. Check your staff permissions.', true);
    input.disabled = false;
  }
});

copyYesterdayButton.addEventListener('click', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday.getTime());
  const existingKeys = new Set(todayListings().map(listing => `${listing.foodType}|${listing.category}`));
  const yesterdayListings = liveListings.filter(listing => listingDate(listing) === yesterdayKey && !existingKeys.has(`${listing.foodType}|${listing.category}`));
  if (!yesterdayListings.length) {
    showFormStatus('There are no new items to copy from yesterday.');
    return;
  }
  copyYesterdayButton.disabled = true;
  showFormStatus('Copying yesterday\'s list...');
  try {
    const copiedListings = await Promise.all(yesterdayListings.map(async listing => {
      const stockLevel = listingStockLevel(listing);
      const copy = { foodType: listing.foodType, category: listing.category, photoUrl: listing.photoUrl || '', notes: listing.notes || '', postedAt: Date.now(), stockDate: localDateKey(), stockLevel, quantity: stockLevelQuantities[stockLevel], status: 'available', postedBy: window.auth.currentUser.email };
      const createdListing = await addDoc(listingsCollection(), copy);
      return { id: createdListing.id, ...copy };
    }));
    liveListings = [...copiedListings, ...liveListings];
    renderStaffInventory();
    showFormStatus(`${copiedListings.length} item${copiedListings.length === 1 ? '' : 's'} copied. Adjust quantities below.`);
  } catch (error) {
    console.error('Unable to copy yesterday\'s listings:', error);
    showFormStatus('Yesterday\'s list could not be copied. Check your staff permissions.', true);
  } finally {
    copyYesterdayButton.disabled = false;
  }
});

listingFeed.addEventListener('click', async event => {
  const button = event.target.closest('[data-remove-id]');
  if (!button || !window.confirm("Remove this item from today's pantry stock?")) return;
  button.disabled = true;
  try {
    await deleteDoc(doc(window.db, 'listings', button.dataset.removeId));
  } catch (error) {
    console.error('Unable to remove listing:', error);
    button.disabled = false;
    window.alert('Only the configured pantry admin can remove inventory items.');
  }
});

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  const email = document.querySelector('#email').value.trim().toLowerCase();
  const password = document.querySelector('#password').value;
  if (!email.endsWith(allowedDomain) && !pantryStaffEmails.has(email)) {
    authStatus.textContent = 'Please use your @calpoly.edu email address.';
    return;
  }
  authStatus.textContent = 'Signing in...';
  try {
    const credential = await signInWithEmailAndPassword(window.auth, email, password);
    if (!credential.user.emailVerified) {
      authStatus.textContent = '';
      showVerificationMessage('Check your inbox for the verification email, or use Resend email if you need another copy.');
    }
  } catch (error) {
    console.error('Sign-in failed:', error);
    authStatus.textContent = authErrorMessage(error);
  }
});

createAccountButton.addEventListener('click', async () => {
  const email = document.querySelector('#email').value.trim().toLowerCase();
  const password = document.querySelector('#password').value;
  if (!email.endsWith(allowedDomain) && !pantryStaffEmails.has(email)) {
    authStatus.textContent = 'Accounts are limited to @calpoly.edu emails.';
    return;
  }
  authStatus.textContent = 'Creating your account...';
  createAccountButton.disabled = true;
  try {
    const credential = await createUserWithEmailAndPassword(window.auth, email, password);
    authStatus.textContent = '';
    try {
      await sendVerificationEmail(credential.user, 'Verification email sent. Check your inbox, spam, and junk folders.');
    } catch (error) {
      console.error('Verification email failed:', error);
      showVerificationMessage(`${verificationEmailMessage(error)} (${error.code || 'unknown error'})`, true);
    }
  } catch (error) {
    console.error('Account creation failed:', error);
    authStatus.textContent = authErrorMessage(error);
  } finally {
    createAccountButton.disabled = false;
  }
});

signOutButton?.addEventListener('click', () => signOut(window.auth));

async function showVerifiedApp(user) {
  const verified = user?.emailVerified === true;
  const isStaff = pantryStaffEmails.has(user?.email?.toLowerCase());
  const canUseApp = verified || isStaff;
  authPanel.classList.toggle('hidden', canUseApp);
  authForm.classList.toggle('hidden', canUseApp || Boolean(user));
  verificationPanel.classList.toggle('hidden', canUseApp || !user);
  appShell.classList.toggle('hidden', !canUseApp);
  signOutButton.classList.toggle('hidden', !user);
  userEmail.textContent = user ? user.email : 'Not signed in';
  if (user && !canUseApp) {
    verificationEmail.textContent = user.email;
    if (!verificationStatus.textContent) showVerificationMessage('Your pantry access is locked until email confirmation.');
    return;
  }
  if (canUseApp) {
    // Refresh the token so Firestore receives the current authentication claims.
    await user.getIdToken(true);
    document.querySelector('[data-role="staff"]')?.classList.toggle('hidden', !isStaff);
    setRole(isStaff ? 'staff' : 'student');
    subscribeToListings();
  }
}

resendVerificationButton.addEventListener('click', async () => {
  resendVerificationButton.disabled = true;
  try {
    await sendVerificationEmail(window.auth.currentUser, 'A new verification email is on its way. Check spam or junk folders too.');
  } catch (error) {
    console.error('Verification email failed:', error);
    showVerificationMessage(`${verificationEmailMessage(error)} (${error.code || 'unknown error'})`, true);
  } finally {
    resendVerificationButton.disabled = false;
  }
});

checkVerificationButton.addEventListener('click', async () => {
  checkVerificationButton.disabled = true;
  await window.auth.currentUser.reload();
  await showVerifiedApp(window.auth.currentUser);
  checkVerificationButton.disabled = false;
  if (!window.auth.currentUser.emailVerified) verificationStatus.textContent = 'We do not see a confirmation yet. Open the link in your email, then try again.';
});

onAuthStateChanged(window.auth, user => {
  showVerifiedApp(user);
});
