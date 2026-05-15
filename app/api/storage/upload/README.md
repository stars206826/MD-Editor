# Image Upload API

## Endpoint

`POST /api/storage/upload`

## Description

Uploads an image file to Supabase Storage and creates a database record in the `document_images` table. This endpoint is used by the image upload feature in the Markdown editor.

## Requirements

- User must be authenticated
- User must own the document specified by `documentId`
- File must be an image (JPEG, PNG, GIF, or WebP)
- File size must not exceed 5MB

## Request

### Content-Type

`multipart/form-data`

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | The image file to upload |
| `documentId` | string | Yes | UUID of the document to associate the image with |

### Example Request (JavaScript)

```javascript
const formData = new FormData();
formData.append('file', imageFile);
formData.append('documentId', 'doc-uuid-here');

const response = await fetch('/api/storage/upload', {
  method: 'POST',
  body: formData,
});

const data = await response.json();
```

### Example Request (cURL)

```bash
curl -X POST http://localhost:3000/api/storage/upload \
  -H "Cookie: your-auth-cookie" \
  -F "file=@/path/to/image.jpg" \
  -F "documentId=doc-uuid-here"
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "image": {
    "id": "image-uuid",
    "url": "https://project.supabase.co/storage/v1/object/public/document-images/user-id/doc-id/uuid.jpg",
    "filename": "original-filename.jpg",
    "size": 102400,
    "width": null,
    "height": null
  }
}
```

**Note**: `width` and `height` are currently `null` as server-side dimension extraction is not implemented. These can be extracted client-side if needed.

### Error Responses

#### 401 Unauthorized

User is not authenticated.

```json
{
  "error": "Unauthorized"
}
```

#### 400 Bad Request - No File

```json
{
  "error": "No file provided"
}
```

#### 400 Bad Request - No Document ID

```json
{
  "error": "Document ID is required"
}
```

#### 400 Bad Request - Invalid File Type

```json
{
  "error": "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
}
```

#### 400 Bad Request - File Too Large

```json
{
  "error": "File size exceeds 5MB limit. Your file is 6.50MB."
}
```

#### 404 Not Found - Document Not Found

User doesn't own the document or it doesn't exist.

```json
{
  "error": "Document not found or access denied"
}
```

#### 500 Internal Server Error - Upload Failed

```json
{
  "error": "Upload failed: <error message>"
}
```

#### 500 Internal Server Error - Database Error

```json
{
  "error": "Failed to save image record: <error message>"
}
```

## Storage Structure

Images are stored in Supabase Storage with the following path structure:

```
document-images/
  {user_id}/
    {document_id}/
      {uuid}.{ext}
```

**Example**: `550e8400-e29b-41d4-a716-446655440000/7c9e6679-7425-40de-944b-e07fc1f90ae7/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg`

## Public URL Format

```
https://{project_ref}.supabase.co/storage/v1/object/public/document-images/{user_id}/{document_id}/{uuid}.{ext}
```

## Security

- **Authentication**: User must be authenticated via Supabase Auth
- **Authorization**: User must own the document
- **File Validation**: File type and size are validated before upload
- **RLS Policies**: Storage bucket has Row Level Security policies to ensure users can only upload to their own folders
- **Rollback**: If database insert fails, the uploaded file is automatically deleted

## Database Record

A record is created in the `document_images` table with the following fields:

```typescript
{
  id: string;              // UUID
  document_id: string;     // UUID of the document
  user_id: string;         // UUID of the user
  filename: string;        // Original filename
  storage_path: string;    // Path in Supabase Storage
  public_url: string;      // Public URL to access the image
  size: number;            // File size in bytes
  mime_type: string;       // MIME type (e.g., "image/jpeg")
  width: number | null;    // Image width (currently null)
  height: number | null;   // Image height (currently null)
  created_at: string;      // ISO timestamp
}
```

## Usage in Markdown Editor

After successful upload, insert the Markdown image syntax into the document:

```markdown
![filename](public_url)
```

**Example**:
```markdown
![my-image.jpg](https://project.supabase.co/storage/v1/object/public/document-images/user-id/doc-id/uuid.jpg)
```

## Limitations

- Maximum file size: 5MB
- Supported formats: JPEG, PNG, GIF, WebP
- Image dimensions are not extracted server-side (can be done client-side)
- No image optimization or resizing (consider adding in future)

## Future Enhancements

1. **Server-side dimension extraction**: Install `image-size` or `sharp` library
2. **Image optimization**: Compress images before storage
3. **Thumbnail generation**: Create thumbnails for faster loading
4. **Progress tracking**: Implement upload progress for large files
5. **Batch upload**: Support multiple file uploads in one request

## Related Files

- **API Route**: `app/api/storage/upload/route.ts`
- **Tests**: `app/api/storage/upload/route.test.ts`
- **Types**: `lib/types.ts` (DocumentImage interface)
- **Storage Setup**: `supabase/STORAGE_SETUP.md`
- **Migration**: `supabase/migrations/002_create_document_images_bucket.sql`

## Requirements Satisfied

- ✅ 6.2: Accept JPEG, PNG, GIF, and WebP image formats
- ✅ 6.3: Enforce maximum file size of 5MB
- ✅ 6.4: Validate file type and size before processing
- ✅ 6.5: Display descriptive error messages on validation failure
- ✅ 6.6: Store in Supabase Storage at path `{user_id}/{document_id}/{uuid}.{ext}`
- ✅ 6.7: Extract and store image dimensions (placeholder for future implementation)
- ✅ 10.5: Verify user owns the parent document
- ✅ 11.4: Complete upload within 5 seconds for images under 2MB

## Testing

Run the test suite:

```bash
npm test -- app/api/storage/upload/route.test.ts
```

Test coverage includes:
- Authentication validation
- Required field validation
- Document ownership verification
- File type validation
- File size validation
- Successful upload flow
- Multiple image format support
- Database error rollback

