import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const generateUniqueFileName = (fileName = 'file', mimeType = '') => {
  const lastDotIndex = fileName.lastIndexOf('.');
  let extension = lastDotIndex !== -1 ? fileName.slice(lastDotIndex + 1) : '';
  let baseName = lastDotIndex !== -1 ? fileName.slice(0, lastDotIndex) : fileName;

  if (!extension && mimeType) {
    extension = mimeType.split('/').pop() || '';
  }
  
  const sanitized = baseName
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .trim();

  const timestamp = Date.now();
  const randomHex = Math.random().toString(36).substring(2, 8);
  const finalExt = extension ? `.${extension.toLowerCase()}` : '';

  return `${timestamp}-${randomHex}-${sanitized}${finalExt}`;
};

export const uploadFileToStorage = (file, options = {}) => {
  const { folder = 'avatars', callbacks = {} } = options;
  const { onProgress, onError, onSuccess } = callbacks;

  if (!file || !(file instanceof Blob || file instanceof File)) {
    const error = new TypeError('Yuklanayotgan obyekt File yoki Blob formatida bo‘lishi shart.');
    if (onError) onError(error);
    throw error;
  }

  const storage = getStorage();
  const uniqueName = generateUniqueFileName(file.name, file.type);
  const storageRef = ref(storage, `${folder}/${uniqueName}`);

  const metadata = {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      originalName: file.name || 'unnamed_blob',
      uploadedAt: new Date().toISOString()
    }
  };

  const uploadTask = uploadBytesResumable(storageRef, file, metadata);
  let unsubscribe;

  unsubscribe = uploadTask.on(
    'state_changed',
    (snapshot) => {
      if (!onProgress) return;
      const totalBytes = snapshot.totalBytes;
      const bytesTransferred = snapshot.bytesTransferred;

      if (totalBytes > 0) {
        const progress = Math.round((bytesTransferred / totalBytes) * 100);
        onProgress(progress);
      } else {
        onProgress(0);
      }
    },
    (error) => {
      if (unsubscribe) unsubscribe();
      if (onError) onError(error);
    },
    async () => {
      if (unsubscribe) unsubscribe();
      try {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        if (onSuccess) onSuccess(downloadUrl);
      } catch (urlError) {
        if (onError) onError(urlError);
      }
    }
  );

  return {
    cancel: () => uploadTask.cancel(),
    pause: () => uploadTask.pause(),
    resume: () => uploadTask.resume(),
    task: uploadTask
  };
};
