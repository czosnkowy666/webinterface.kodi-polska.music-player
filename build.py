import xml.etree.ElementTree as ET
import zipfile
import os
import shutil

metadataFile = 'addon.xml'
addonMetada = None
targetFolder = 'target'

def getAddonXML():
    tree = ET.parse(metadataFile)
    return tree.getroot()

def getAddonID(xmlObj):
    print("=== getting id ===")
    return xmlObj.attrib.get("id")

def getAddonVersion(xmlObj):
    print("=== getting version ===")
    return xmlObj.attrib.get("version")

def buildZip(id, version):
    print(f"=== creating zip for {id}-{version}===")

    bundleName = f"{id}-{version}"
    bundleZip = f"{bundleName}.zip"    
    bundlePath = os.path.join(targetFolder, bundleZip)

    with zipfile.ZipFile(bundlePath, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file in ["addon.xml", "favicon.svg", "index.html"]:
            if os.path.exists(file):
                zipf.write(file, arcname=os.path.join(id, file))

def copyAddonXML():
    shutil.copy(metadataFile, os.path.join(targetFolder, metadataFile))

def clean():
    print("=== cleaning ===")
    for fileName in os.listdir(targetFolder):
        os.remove(os.path.join(targetFolder, fileName))

clean()

addonXML = getAddonXML()
id = getAddonID(addonXML)
version = getAddonVersion(addonXML)

buildZip(id, version)
copyAddonXML()