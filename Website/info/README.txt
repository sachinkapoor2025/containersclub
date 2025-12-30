Info folder (static, no build steps)
--------------------------------------
Place this 'info' folder directly inside your existing website root WITHOUT changing your structure.

Paths assumed:
  /info/index.html
  /info/app.js
  /info/containers.xlsx
  /info/Global_Container_Types_Expanded_110_With_Capacity_Images.xlsx

How to deploy to S3:
  aws s3 cp info s3://YOUR_BUCKET/info --recursive
    (optional) set short cache for xlsx and correct MIME:
  aws s3 cp info/Global_Container_Types_Expanded_110_With_Capacity_Images.xlsx s3://YOUR_BUCKET/info/Global_Container_Types_Expanded_110_With_Capacity_Images.xlsx --content-type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet --cache-control public,max-age=300
  aws s3 cp info/containers.xlsx s3://YOUR_BUCKET/info/containers.xlsx --content-type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet --cache-control public,max-age=300

CloudFront:
  - Consider a behavior for /info/*.xlsx with TTL ~300s.
  - If you update the Excel, invalidate /info/* to refresh immediately.
