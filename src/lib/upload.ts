import { v2 as cloudinary } from "cloudinary"
import { Readable } from "stream"

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

/**
 * Upload a file to Cloudinary
 * @param file Buffer or readable stream of the file
 * @param options Upload options
 * @returns Promise with upload result
 */
export async function uploadToCloudinary(
  file: Buffer | Readable,
  options: {
    folder?: string
    publicId?: string
    width?: number
    height?: number
    crop?: string
    [key: string]: unknown
  } = {}
) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "laçolaria-erp",
        public_id: options.publicId,
        width: options.width,
        height: options.height,
        crop: options.crop || "fill",
        ...options
      },
      (error: unknown, result: unknown) => {
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      }
    )

    if (Buffer.isBuffer(file)) {
      // Convert buffer to readable stream
      const stream = Readable.from(file)
      stream.pipe(uploadStream)
    } else {
      // Assume it's already a readable stream
      file.pipe(uploadStream)
    }
  })
}

/**
 * Delete a file from Cloudinary
 * @param publicId Public ID of the file to delete
 * @returns Promise with deletion result
 */
export async function deleteFromCloudinary(publicId: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error: unknown, result: unknown) => {
      if (error) {
        reject(error)
      } else {
        resolve(result)
      }
    })
  })
}

/**
 * Get URL for a Cloudinary resource
 * @param publicId Public ID of the resource
 * @param options Transformation options
 * @returns URL string
 */
export function getCloudinaryUrl(publicId: string, options: {
  width?: number
  height?: number
  format?: string
  [key: string]: unknown
} = {}): string {
  return cloudinary.url(publicId, {
    width: options.width,
    height: options.height,
    format: options.format,
    ...options
  })
}

const uploadLib = {
  uploadToCloudinary,
  deleteFromCloudinary,
  getCloudinaryUrl
}

export default uploadLib
