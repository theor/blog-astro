
const load = async function () {
    let images: Record<string, () => Promise<unknown>> | undefined = undefined;
      images = import.meta.glob(['./content/blog/**/**.*','!**.mdx','!**.md_']);
      console.log("all", images);
   
    return images;
  };
  
  let _images;
  
  /** */
  export const fetchLocalImages = async () => {
    _images = _images || load();
    return await _images;
  };

  export const findImage = async (imagePath?: string) => {
    // if (typeof imagePath !== 'string') {
    //   return null;
    // }
  
    // if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    //   return imagePath;
    // }
  
    const images = await fetchLocalImages();
    console.log("find ", imagePath)
    const key = `./content/blog/${imagePath}`;//.replace('~/', '/src/');
  return typeof images[key] === 'function' ? (await images[key]())['default'] : null;
  };

  export const isVideo = (x:string): boolean => {
    return x.endsWith('webm') || x.endsWith('mp4') || x.endsWith('m4v');
  }