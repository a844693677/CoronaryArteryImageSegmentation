import numpy as np
import os #遍历文件夹
import nibabel as nib #nii格式一般都会用到这个包
nii_input = nib.load(r'D:\NEFU\WebShowNifti\cornerstone3D\nifti\5_0000.nii.gz')
data_input = nii_input.get_fdata()
nii_output = nib.load(r'D:\NEFU\WebShowNifti\cornerstone3D\nifti\5.nii.gz')
data_output = nii_output.get_fdata()

data_res = data_input * data_output;

header_res = nii_input.header.copy()
nii_res = nib.nifti1.Nifti1Image(data_res, None, header = header_res)


nib.save(nii_res, r'D:\NEFU\WebShowNifti\cornerstone3D\nifti\result5.nii.gz')

