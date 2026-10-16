// Pick one or more files on the phone and read them as text (book JSON, PGN).
// The website uses <input type=file> + File.text(); here the system picker
// gives URIs, read through expo-file-system.
import * as DocumentPicker from 'expo-document-picker'
import { File as FsFile } from 'expo-file-system'

export interface PickedText { name: string; text: string }

/**
 * Returns null when the user cancels. Any file type is accepted: .pgn and
 * .book.json have no reliable MIME type, so a narrower filter would grey
 * them out on Android.
 */
export async function pickTextFiles(): Promise<PickedText[] | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true })
  if (res.canceled) return null
  const out: PickedText[] = []
  for (const asset of res.assets) {
    // On the web build the picker hands over the browser File directly.
    const text = asset.file ? await asset.file.text() : await new FsFile(asset.uri).text()
    out.push({ name: asset.name, text })
  }
  return out
}
